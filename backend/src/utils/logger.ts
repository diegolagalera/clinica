import pino from 'pino';
import { config } from '../config/env.js';

export const logger = pino({
    level: config.logging.level,
    transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    base: {
        env: config.env,
    },
});

export const createChildLogger = (context: Record<string, unknown>) => {
    return logger.child(context);
};
