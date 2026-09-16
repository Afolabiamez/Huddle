export function validateEnvironment(config: Record<string, unknown>) {
  for (const name of ['JWT_SECRET', 'DATABASE_URL']) {
    if (typeof config[name] !== 'string' || !config[name].trim()) {
      throw new Error(
        `${name} is required. Configure it in the backend environment.`,
      );
    }
  }

  if (Buffer.byteLength(config.JWT_SECRET as string, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 UTF-8 bytes.');
  }

  try {
    const url = new URL(config.DATABASE_URL as string);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length <= 1
    ) {
      throw new Error('Invalid PostgreSQL URL');
    }
  } catch {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL connection URL with a database name.',
    );
  }

  const nodeEnv = config.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv as string)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const rawPort = config.PORT ?? 3000;
  const port = Number(rawPort);
  if (
    !['number', 'string'].includes(typeof rawPort) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    (typeof rawPort === 'string' && !/^\d+$/.test(rawPort))
  ) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { ...config, NODE_ENV: nodeEnv, PORT: port };
}
