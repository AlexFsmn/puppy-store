import {getRedis} from '@puppy-store/shared';
import Redis from 'ioredis';
import {logger} from '@puppy-store/shared';
import {ChatMessage} from './types';

// Separate Redis client for subscriptions (required by ioredis)
let subClient: Redis | null = null;

// Local broadcast callback - set by handlers
let localBroadcastCallback: ((roomId: string, message: ChatMessage, excludeUserId?: string) => void) | null = null;

/**
 * Get or create the subscriber client
 * Pub/Sub requires a dedicated connection that can't be used for other commands
 */
function getSubClient(): Redis {
  if (!subClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    subClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    subClient.on('connect', () => {
      logger.info('Redis Pub/Sub subscriber connected');
    });

    subClient.on('error', (err) => {
      logger.error({err}, 'Redis Pub/Sub subscriber error');
    });
  }
  return subClient;
}

/**
 * Register the local broadcast callback
 * Called by handlers to set up the connection between pub/sub and local WebSocket broadcasting
 */
export function registerLocalBroadcast(
  callback: (roomId: string, message: ChatMessage, excludeUserId?: string) => void
): void {
  localBroadcastCallback = callback;
}

/**
 * Subscribe to a room channel
 */
export async function subscribeToRoom(roomId: string): Promise<void> {
  const sub = getSubClient();
  const channel = `room:${roomId}`;

  await sub.subscribe(channel);
  logger.debug({roomId, channel}, 'Subscribed to room channel');
}

/**
 * Unsubscribe from a room channel
 */
export async function unsubscribeFromRoom(roomId: string): Promise<void> {
  const sub = getSubClient();
  const channel = `room:${roomId}`;

  await sub.unsubscribe(channel);
  logger.debug({roomId, channel}, 'Unsubscribed from room channel');
}

/**
 * Publish a message to a room channel
 * All pods subscribed to this channel will receive the message
 */
export async function publishToRoom(
  roomId: string,
  message: ChatMessage,
  senderId?: string
): Promise<void> {
  const redis = getRedis();
  const channel = `room:${roomId}`;

  const payload = JSON.stringify({
    message,
    senderId, // Used to exclude sender from receiving their own message
  });

  await redis.publish(channel, payload);
  logger.debug({roomId, channel}, 'Published message to room channel');
}

/**
 * Initialize the Pub/Sub message handler
 * Listens for messages on subscribed channels and broadcasts locally
 */
export function initPubSubHandler(): void {
  const sub = getSubClient();

  sub.on('message', (channel, data) => {
    if (!channel.startsWith('room:')) return;

    try {
      const {message, senderId} = JSON.parse(data) as {
        message: ChatMessage;
        senderId?: string;
      };

      const roomId = channel.replace('room:', '');

      // Broadcast to local connections (excluding original sender)
      if (localBroadcastCallback) {
        localBroadcastCallback(roomId, message, senderId);
      }
    } catch (err) {
      logger.error({err, channel}, 'Failed to handle Pub/Sub message');
    }
  });

  logger.info('Redis Pub/Sub handler initialized');
}

/**
 * Close Pub/Sub connections (for graceful shutdown)
 */
export async function closePubSub(): Promise<void> {
  if (subClient) {
    await subClient.quit();
    subClient = null;
  }
}
