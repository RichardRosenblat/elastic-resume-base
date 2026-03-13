import { pino } from 'pino';
import { config } from '../config.js';

/** Application logger using Pino. Uses pino-pretty in non-production environments. */
export const logger = pino({
  level: config.logLevel ?? 'info',
  ...(config.nodeEnv !== 'production' && {
    transport: { target: 'pino-pretty' },
  }),
});
