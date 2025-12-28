import express from 'express';
import cors from 'cors';
import {logger} from '@puppy-store/shared';
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({status: 'ok', service: 'puppies'});
});

// Mount routes
app.use(routes);

app.listen(PORT, () => {
  logger.info({port: PORT}, 'Puppies service started');
});
