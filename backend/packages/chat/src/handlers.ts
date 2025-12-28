import {WebSocket} from 'ws';
import {AuthenticatedWebSocket, ChatMessage} from './types';
import * as chatService from './services/chat';
import {ChatError} from './services/chat';

// Track connections and room subscriptions
export const userConnections = new Map<string, Set<AuthenticatedWebSocket>>();
export const roomSubscriptions = new Map<string, Set<string>>();

export function broadcast(roomId: string, message: ChatMessage, excludeUserId?: string): void {
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

export async function handleJoin(ws: AuthenticatedWebSocket, roomId: string): Promise<void> {
  try {
    const chatRoom = await chatService.getOrCreateChatRoom(roomId, ws.userId);

    if (!roomSubscriptions.has(chatRoom.id)) {
      roomSubscriptions.set(chatRoom.id, new Set());
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

export function handleTyping(ws: AuthenticatedWebSocket, roomId: string): void {
  broadcast(roomId, {
    type: 'typing',
    roomId,
    message: {userId: ws.userId},
  }, ws.userId);
}

export function handleLeave(ws: AuthenticatedWebSocket, roomId: string): void {
  const roomUsers = roomSubscriptions.get(roomId);
  if (roomUsers) {
    roomUsers.delete(ws.userId);
    if (roomUsers.size === 0) {
      roomSubscriptions.delete(roomId);
    }
  }
}

export function handleDisconnect(ws: AuthenticatedWebSocket): void {
  const connections = userConnections.get(ws.userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      userConnections.delete(ws.userId);
    }
  }

  roomSubscriptions.forEach((users, roomId) => {
    users.delete(ws.userId);
    if (users.size === 0) {
      roomSubscriptions.delete(roomId);
    }
  });
}
