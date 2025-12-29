import {WebSocket} from 'ws';
import {AuthenticatedWebSocket, ChatMessage} from './types';
import * as chatService from './services/chat';
import {ChatError} from './services/chat';
import {
  publishToRoom,
  subscribeToRoom,
  unsubscribeFromRoom,
  registerLocalBroadcast,
} from './pubsub';

// Track connections and room subscriptions (local to this pod)
export const userConnections = new Map<string, Set<AuthenticatedWebSocket>>();
export const roomSubscriptions = new Map<string, Set<string>>();

/**
 * Broadcast to local connections only (called by Pub/Sub handler)
 */
export function broadcastLocal(roomId: string, message: ChatMessage, excludeUserId?: string): void {
  const roomUsers = roomSubscriptions.get(roomId);
  if (!roomUsers) return;

  const payload = JSON.stringify(message);

  roomUsers.forEach((userId) => {
    if (userId === excludeUserId) return;
    const connections = userConnections.get(userId);
    connections?.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  });
}

/**
 * Publish message to Redis for cross-pod broadcasting
 */
async function broadcast(roomId: string, message: ChatMessage, excludeUserId?: string): Promise<void> {
  // Publish to Redis - all pods (including this one) will receive via subscription
  await publishToRoom(roomId, message, excludeUserId);
}

// Register local broadcast callback for Pub/Sub handler
registerLocalBroadcast(broadcastLocal);

export async function handleJoin(ws: AuthenticatedWebSocket, roomId: string): Promise<void> {
  try {
    const chatRoom = await chatService.getOrCreateChatRoom(roomId, ws.userId);

    // Subscribe to Redis channel if this is the first local user in this room
    const isFirstLocalUser = !roomSubscriptions.has(chatRoom.id);
    if (isFirstLocalUser) {
      roomSubscriptions.set(chatRoom.id, new Set());
      await subscribeToRoom(chatRoom.id);
    }
    roomSubscriptions.get(chatRoom.id)!.add(ws.userId);

    ws.send(JSON.stringify({
      type: 'history',
      roomId: chatRoom.id,
      messages: chatRoom.messages,
    }));

    ws.send(JSON.stringify({type: 'joined', roomId: chatRoom.id}));
  } catch (error) {
    if (error instanceof ChatError) {
      ws.send(JSON.stringify({type: 'error', error: error.message}));
      return;
    }
    throw error;
  }
}

export async function handleMessage(
  ws: AuthenticatedWebSocket,
  applicationId: string,
  content: string
): Promise<void> {
  if (!content?.trim()) return;

  try {
    const {chatRoomId, message} = await chatService.createMessage(applicationId, ws.userId, content);

    broadcast(chatRoomId, {
      type: 'message',
      roomId: chatRoomId,
      message,
    });
  } catch (error) {
    if (error instanceof ChatError) {
      ws.send(JSON.stringify({type: 'error', error: error.message}));
      return;
    }
    throw error;
  }
}

export async function handleTyping(ws: AuthenticatedWebSocket, roomId: string): Promise<void> {
  await broadcast(roomId, {
    type: 'typing',
    roomId,
    message: {userId: ws.userId},
  }, ws.userId);
}

export async function handleLeave(ws: AuthenticatedWebSocket, roomId: string): Promise<void> {
  const roomUsers = roomSubscriptions.get(roomId);
  if (roomUsers) {
    roomUsers.delete(ws.userId);
    if (roomUsers.size === 0) {
      roomSubscriptions.delete(roomId);
      // Unsubscribe from Redis channel when no local users remain
      await unsubscribeFromRoom(roomId);
    }
  }
}

export async function handleDisconnect(ws: AuthenticatedWebSocket): Promise<void> {
  const connections = userConnections.get(ws.userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      userConnections.delete(ws.userId);
    }
  }

  // Collect rooms to unsubscribe from
  const roomsToUnsubscribe: string[] = [];

  roomSubscriptions.forEach((users, roomId) => {
    users.delete(ws.userId);
    if (users.size === 0) {
      roomSubscriptions.delete(roomId);
      roomsToUnsubscribe.push(roomId);
    }
  });

  // Unsubscribe from Redis channels for empty rooms
  await Promise.all(roomsToUnsubscribe.map(roomId => unsubscribeFromRoom(roomId)));
}
