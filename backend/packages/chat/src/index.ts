import {WebSocketServer, WebSocket} from 'ws';
import http from 'http';
import {logger} from '@puppy-store/shared';
import {verifyToken} from './auth';
import {AuthenticatedWebSocket, ChatMessage} from './types';
import {
  userConnections,
  handleJoin,
  handleMessage,
  handleTyping,
  handleLeave,
  handleDisconnect,
} from './handlers';

const PORT = parseInt(process.env.PORT || '3004');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'ok', service: 'chat'}));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({server});

wss.on('connection', (ws: WebSocket, req) => {
  const authWs = ws as AuthenticatedWebSocket;

  // Authenticate via query param
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'Authentication required');
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    ws.close(4001, 'Invalid token');
    return;
  }

  authWs.userId = payload.userId;
  authWs.email = payload.email;
  authWs.isAlive = true;

  // Track connection
  if (!userConnections.has(authWs.userId)) {
    userConnections.set(authWs.userId, new Set());
  }
  userConnections.get(authWs.userId)!.add(authWs);

  // Handle pong for keepalive
  authWs.on('pong', () => {
    authWs.isAlive = true;
  });

  // Handle messages
  authWs.on('message', async (data) => {
    try {
      const msg: ChatMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'join':
          if (msg.roomId) await handleJoin(authWs, msg.roomId);
          break;
        case 'leave':
          if (msg.roomId) handleLeave(authWs, msg.roomId);
          break;
        case 'message':
          if (msg.roomId && msg.content) {
            await handleMessage(authWs, msg.roomId, msg.content);
          }
          break;
        case 'typing':
          if (msg.roomId) handleTyping(authWs, msg.roomId);
          break;
      }
    } catch (error) {
      logger.error({err: error}, 'Message handling error');
      authWs.send(JSON.stringify({type: 'error', error: 'Invalid message format'}));
    }
  });

  // Handle disconnect
  authWs.on('close', () => {
    handleDisconnect(authWs);
  });
});

// Keepalive ping
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    const authWs = ws as AuthenticatedWebSocket;
    if (!authWs.isAlive) {
      authWs.terminate();
      return;
    }
    authWs.isAlive = false;
    authWs.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

server.listen(PORT, () => {
  logger.info({port: PORT}, 'Chat WebSocket service started');
});
