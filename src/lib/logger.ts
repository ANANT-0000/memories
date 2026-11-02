import { publicEnv } from '@/lib/env/public';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogPayload {
  level: LogLevel;
  msg: string;
  timestamp: string;
  context?: Record<string, unknown> | undefined;
  error?: {
    message: string;
    stack?: string | undefined;
    name?: string | undefined;
  } | undefined;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'pin',
  'token',
  'secret',
  'cookie',
  'authorization',
  'apikey',
  'admin_token',
  'service_role',
]);

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      sanitized[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitize(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function formatError(err: unknown) {
  if (err instanceof Error) {
    const stack = publicEnv.NODE_ENV === 'production' ? undefined : err.stack;
    return {
      name: err.name,
      message: err.message,
      ...(stack !== undefined ? { stack } : {}),
    };
  }
  if (err && typeof err === 'object') {
    return {
      message: JSON.stringify(err),
    };
  }
  return {
    message: String(err),
  };
}

class Logger {
  private isProd = publicEnv.NODE_ENV === 'production';

  private emit(level: LogLevel, msg: string, context?: Record<string, unknown>, error?: unknown) {
    const timestamp = new Date().toISOString();
    const cleanContext = context ? (sanitize(context) as Record<string, unknown>) : undefined;
    const errObj = error ? formatError(error) : undefined;

    if (this.isProd) {
      const payload: LogPayload = {
        level,
        msg,
        timestamp,
        ...(cleanContext ? { context: cleanContext } : {}),
        ...(errObj ? { error: errObj } : {}),
      };
      const json = JSON.stringify(payload);
      if (level === 'error') {
        process.stderr.write(json + '\n');
      } else {
        process.stdout.write(json + '\n');
      }
    } else {
      const prefix = `[${timestamp}] [${level.toUpperCase()}] ${msg}`;
      const details = cleanContext ? ` | ${JSON.stringify(cleanContext)}` : '';
      if (level === 'error') {
        process.stderr.write(`${prefix}${details}\n`);
        if (error) {
          process.stderr.write(`${error instanceof Error && error.stack ? error.stack : String(error)}\n`);
        }
      } else {
        process.stdout.write(`${prefix}${details}\n`);
      }
    }
  }

  debug(msg: string, context?: Record<string, unknown>) {
    this.emit('debug', msg, context);
  }

  info(msg: string, context?: Record<string, unknown>) {
    this.emit('info', msg, context);
  }

  warn(msg: string, context?: Record<string, unknown>) {
    this.emit('warn', msg, context);
  }

  error(msg: string, error?: unknown, context?: Record<string, unknown>) {
    this.emit('error', msg, context, error);
  }
}

export const logger = new Logger();
