// Initialize observability FIRST - before any other imports
import '@puppy-store/shared/observability/instrument';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {logger} from '@puppy-store/shared';
import {getCurrentProvider} from './llm';
import descriptionsRoutes from './routes/descriptions';
import chatRoutes from './routes/chat';
import feedbackRoutes from './routes/feedback';

const app = express();
const PORT = process.env.PORT || 3003;

// Security headers
app.use(helmet());
app.use(cors());

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'puppy-expert',
    llmProvider: getCurrentProvider(),
  });
});

// Routes
app.use('/descriptions', descriptionsRoutes);
app.use('/chat', chatRoutes);
app.use('/feedback', feedbackRoutes);

const server = app.listen(PORT, () => {
  logger.info({port: PORT, llmProvider: getCurrentProvider()}, 'Puppy Expert service started');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
