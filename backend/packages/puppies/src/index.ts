import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {logger} from '@puppy-store/shared';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3002;

// Security headers
app.use(helmet());
app.use(cors());

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({status: 'ok', service: 'puppies'});
});

// Mount routes
app.use(routes);

const server = app.listen(PORT, () => {
  logger.info({port: PORT}, 'Puppies service started');
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
