import pino from 'pino';
import { config } from '../config/env.js';

const pinoOptions: pino.LoggerOptions = {
    level: config.logging.level,
    base: {
        env: config.env,
    },
};

if (config.isDevelopment) {
    pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    };
}

export const logger = pino(pinoOptions);

export const createChildLogger = (context: Record<string, unknown>) => {
    return logger.child(context);
};
