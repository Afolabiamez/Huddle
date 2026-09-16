import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';

const require = createRequire(import.meta.url);
const backendDir = fileURLToPath(new URL('../', import.meta.url));
const envFile = new URL('../.env.test.local', import.meta.url);
const fileEnv = existsSync(envFile) ? parse(readFileSync(envFile)) : {};
const testUrl = process.env.TEST_DATABASE_URL ?? fileEnv.TEST_DATABASE_URL;
const cancellation = new AbortController();

function run(script, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: backendDir,
      env,
      stdio: 'inherit',
      windowsHide: true,
      signal: cancellation.signal,
    });
    let childError;
    child.on('error', (error) => {
      childError = error;
    });
    child.on('close', (code, signal) => {
      if (childError) reject(childError);
      else if (code === 0) resolve();
      else
        reject(new Error(`E2E command failed (${signal ?? `exit ${code}`}).`));
    });
  });
}

async function main() {
  if (!testUrl?.trim()) {
    throw new Error(
      'Set TEST_DATABASE_URL in Backend/.env.test.local or your environment to a PostgreSQL test database.',
    );
  }
  let url;
  try {
    url = new URL(testUrl);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length <= 1
    ) {
      throw new Error('Invalid URL');
    }
  } catch {
    throw new Error(
      'TEST_DATABASE_URL must be a PostgreSQL connection URL with a database name.',
    );
  }

  const schema = `huddle_e2e_${randomBytes(12).toString('hex')}`;
  url.searchParams.set('schema', schema);
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: url.toString(),
    JWT_SECRET: randomBytes(32).toString('hex'),
    HUDDLE_E2E_SCHEMA: schema,
  };
  const client = new pg.Client({
    connectionString: testUrl,
    connectionTimeoutMillis: 5000,
  });
  let schemaCreated = false;
  const onSignal = () => cancellation.abort();
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    console.log(`Using temporary test schema ${schema}`);
    await run(require.resolve('prisma/build/index.js'), ['generate'], env);
    await run(
      require.resolve('prisma/build/index.js'),
      ['migrate', 'deploy'],
      env,
    );
    const vitestCli = fileURLToPath(
      new URL('./vitest.mjs', import.meta.resolve('vitest/package.json')),
    );
    await run(
      vitestCli,
      ['run', '--config', './vitest.config.e2e.ts', ...process.argv.slice(2)],
      env,
    );
  } finally {
    try {
      if (schemaCreated) {
        // Only this run's newly created, random schema is removed.
        await client.query("SET lock_timeout = '10s'");
        await client.query(`DROP SCHEMA "${schema}" CASCADE`);
        console.log('Temporary test schema removed.');
      }
    } finally {
      await client.end();
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
    }
  }
}

main().catch((error) => {
  console.error(`E2E tests could not complete: ${error.message}`);
  process.exitCode = 1;
});
