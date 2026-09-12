import { validateEnvironment } from './environment.js';

describe('Environment validation', () => {
  const valid = {
    JWT_SECRET: 'environment-validation-test-secret',
    DATABASE_URL: 'postgresql://test:password@localhost:5432/huddle_test',
  };

  it.each(['JWT_SECRET', 'DATABASE_URL'])('requires a nonblank %s', (name) => {
    for (const value of [undefined, '', '   ']) {
      expect(() => validateEnvironment({ ...valid, [name]: value })).toThrow(
        name,
      );
    }
  });

  it.each(['invalid', 'https://localhost/database', 'postgresql://localhost'])(
    'rejects an invalid database URL without exposing credentials',
    (url) => {
      expect(() =>
        validateEnvironment({ ...valid, DATABASE_URL: url }),
      ).toThrow(
        'DATABASE_URL must be a PostgreSQL connection URL with a database name.',
      );
    },
  );

  it('accepts valid PostgreSQL settings', () => {
    expect(validateEnvironment(valid)).toEqual({
      ...valid,
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('rejects short signing secrets and measures Unicode as UTF-8 bytes', () => {
    expect(() =>
      validateEnvironment({ ...valid, JWT_SECRET: 'x'.repeat(31) }),
    ).toThrow('JWT_SECRET must contain at least 32 UTF-8 bytes.');
    expect(() =>
      validateEnvironment({ ...valid, JWT_SECRET: 'x'.repeat(32) }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({ ...valid, JWT_SECRET: '\u00e9'.repeat(16) }),
    ).not.toThrow();
  });

  it.each(['development', 'test', 'production'])(
    'accepts NODE_ENV=%s and converts a port string',
    (nodeEnv) => {
      expect(
        validateEnvironment({ ...valid, NODE_ENV: nodeEnv, PORT: '8080' }),
      ).toMatchObject({ NODE_ENV: nodeEnv, PORT: 8080 });
    },
  );

  it.each(['', 'prod', 'staging', false])(
    'rejects unsupported NODE_ENV=%s',
    (nodeEnv) => {
      expect(() =>
        validateEnvironment({ ...valid, NODE_ENV: nodeEnv }),
      ).toThrow('NODE_ENV must be development, test, or production.');
    },
  );

  it.each(['', '3000.5', 'abc', '1e3', ' 3000 ', 0, -1, 65536, true])(
    'rejects invalid PORT=%s',
    (port) => {
      expect(() => validateEnvironment({ ...valid, PORT: port })).toThrow(
        'PORT must be an integer between 1 and 65535.',
      );
    },
  );
});
