import { pino } from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.logLevel ?? 'info',
  base: { service: 'bff-gateway', version: '1.0.0' },
  ...(config.nodeEnv !== 'production'
    ? { transport: { target: 'pino-pretty' } }
    : {
        formatters: {
          level(label: string) { return { severity: label.toUpperCase() }; },
        },
        messageKey: 'message',
      }),
});
