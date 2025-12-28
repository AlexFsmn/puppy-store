import {useState, useEffect, useCallback, useRef} from 'react';
import {useAuth} from '../contexts/AuthContext';
import {config} from '../config';
import {timing} from '../constants';

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  chatRoomId: string;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
  };
}

interface WebSocketMessage {
  type: string;
  roomId?: string;
  messages?: ChatMessage[];
  message?: ChatMessage;
  error?: string;
  userId?: string;
}

export function useChat(applicationId: string) {
  const {getAccessToken, user} = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      const ws = new WebSocket(`${config.ws.chat}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        // Join the room
        ws.send(JSON.stringify({type: 'join', roomId: applicationId}));
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          switch (data.type) {
            case 'history':
              setMessages(data.messages || []);
              if (data.roomId) {
                setChatRoomId(data.roomId);
              }
              setIsLoading(false);
              break;
            case 'message':
              if (data.message) {
                setMessages((prev) => [...prev, data.message!]);
              }
              break;
            case 'error':
              setError(data.error || 'Unknown error');
              setIsLoading(false);
              break;
            case 'joined':
              if (data.roomId) {
                setChatRoomId(data.roomId);
              }
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        setError('Connection error');
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, timing.reconnect.delay);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsLoading(false);
    }
  }, [applicationId, getAccessToken]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback(
    (content: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'message',
            roomId: applicationId,
            content,
          }),
        );
      }
    },
    [applicationId],
  );

  const sendTyping = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          roomId: applicationId,
        }),
      );
    }
  }, [applicationId]);

  return {
    messages,
    chatRoomId,
    isConnected,
    isLoading,
    error,
    sendMessage,
    sendTyping,
    currentUserId: user?.id,
  };
}
