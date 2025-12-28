// Initialize observability FIRST - before any other imports
import '@puppy-store/shared/observability/instrument';

import express from 'express';
import cors from 'cors';
import {logger} from '@puppy-store/shared';
import {getCurrentProvider} from './llm';
import expertRoutes from './routes/expert';
import recommendationsRoutes from './routes/recommendations';
import descriptionsRoutes from './routes/descriptions';
import chatRoutes from './routes/chat';
import feedbackRoutes from './routes/feedback';

const app = express();
const PORT = process.env.PORT || 3003;

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
app.use('/expert', expertRoutes);
app.use('/recommendations', recommendationsRoutes);
app.use('/descriptions', descriptionsRoutes);
app.use('/chat', chatRoutes);
app.use('/feedback', feedbackRoutes);

app.listen(PORT, () => {
  logger.info({port: PORT, llmProvider: getCurrentProvider()}, 'Puppy Expert service started');
});
