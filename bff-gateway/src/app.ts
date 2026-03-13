import express from 'express';
import { correlationIdMiddleware } from './middleware/correlationId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import router from './routes';

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(correlationIdMiddleware);
app.use(requestLogger);

app.use(router);

app.use(errorHandler);

export default app;
