import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import router from './routes/index.js';
import { config } from './config.js';
import { setupSwagger } from './swagger.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.allowedOrigins.split(',') }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(correlationIdMiddleware);
app.use(requestLogger);

setupSwagger(app);

app.use(router);

app.use(errorHandler);

export default app;
