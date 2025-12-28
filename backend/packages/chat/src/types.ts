import {WebSocket} from 'ws';

export {TokenPayload} from '@puppy-store/shared';

export interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  email: string;
  isAlive: boolean;
}

export interface ChatMessage {
  type: 'join' | 'leave' | 'message' | 'typing' | 'history' | 'error' | 'joined';
  roomId?: string;
  content?: string;
  message?: unknown;
  messages?: unknown[];
  error?: string;
}
