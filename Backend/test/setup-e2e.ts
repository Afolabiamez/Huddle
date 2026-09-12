const schema = process.env.HUDDLE_E2E_SCHEMA;
const databaseUrl = process.env.DATABASE_URL;

if (
  process.env.NODE_ENV !== 'test' ||
  !schema ||
  !/^huddle_e2e_[a-f0-9]{24}$/.test(schema) ||
  !databaseUrl ||
  new URL(databaseUrl).searchParams.get('schema') !== schema
) {
  throw new Error(
    'Run E2E tests with npm run test:e2e to create an isolated test schema.',
  );
}
