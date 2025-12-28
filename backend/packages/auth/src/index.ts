import express from 'express';
import cors from 'cors';
import {logger} from '@puppy-store/shared';
import authRoutes from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({status: 'ok', service: 'auth'});
});

// Mount routes
app.use(authRoutes);

app.listen(PORT, () => {
  logger.info({port: PORT}, 'Auth service started');
});
