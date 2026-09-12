# Huddle backend tests: findings, results, and what still needs checking

This is the testing half of the backend documentation. Read it when you want to know what we tested, which problems the review found, whether those problems were fixed, and how to check the backend yourself. The companion [completed improvements README](README.md) explains exactly where the implementation changed, why each change belongs there, what it does, and what would happen without it.

The latest recorded full verification was on **12 September 2026: 108 unit/HTTP tests and 38 PostgreSQL end-to-end tests passed, for a total of 146**. Lint, type checking, build, compiled application checks and a dependency audit also passed. These are results from that earlier verification. Splitting the documentation into two READMEs did not rerun the application tests.

The review followed **Huddle Sprint1 PRD Final.pdf**, version 1.0 dated 5 September 2026. The backend goal is straightforward: create an account, sign in, create or join a channel, send a message, and read another person's reply and earlier history. Refreshing to retrieve new messages is acceptable for Sprint 1, as agreed by the user. Frontend work is excluded. Private-channel invitations were additional agreed backend work.

## Contents

1. [How to read a test result](#how-to-read-a-test-result)
2. [What the review found and what needed to change](#what-the-review-found-and-what-needed-to-change)
3. [Run the tests yourself](#run-the-tests-yourself)
4. [Understand the test setup](#understand-the-test-setup)
5. [Every test file and what it checks](#every-test-file-and-what-it-checks)
6. [Read the final results correctly](#read-the-final-results-correctly)
7. [Work through an error](#work-through-an-error)
8. [Try a conversation with another person](#try-a-conversation-with-another-person)
9. [Understand what remains outside these checks](#understand-what-remains-outside-these-checks)
10. [Record the next verification](#record-the-next-verification)

## How to read a test result

Think of a test as an example with an answer already written down. It prepares a situation, performs an action, and checks the result. For example: create a private channel, try reading it as a person who is not a member, and expect HTTP 403. If the route returns the private data instead, that test fails.

The suite includes successful actions and deliberately rejected actions. A test expecting 401, 403, 409 or a sanitized 500 can pass because the backend handled the failure correctly. A red server log is therefore not enough to decide whether the suite failed; read the scenario, final test summary and command exit code together.

| Term | What it means here |
| --- | --- |
| Unit test | Checks a small part, such as password validation or a service function. |
| HTTP test | Sends requests through request handling, often with a controlled substitute for the database. |
| E2E test | Runs the real backend modules through HTTP with actual PostgreSQL tables in an isolated test schema. There is no browser in these tests. |
| Mock | A controlled substitute that lets a test choose a response or deliberately cause a failure. |
| Assertion | A statement of the expected result, such as one stored user or HTTP 409. |
| Regression | A behavior that used to work and is broken by a later change. |
| Evidence gap | A behavior that had not been directly demonstrated by the tests. This does not itself mean the feature was broken. |

The [application walkthrough](README.md#start-here-understand-the-pieces) explains controllers, DTOs, guards, services, transactions and sessions if those terms are new to you.

The application already had account creation, password hashing, public-channel membership and stored messaging before this work. Some changes repaired bugs; some added missing behavior; others added evidence for behavior that already worked. The tables below keep those differences clear. Removing a test does not immediately switch off the feature it checks. It removes a repeatable way to notice when that feature breaks later.

## What the review found and what needed to change

These are **historical findings with their current status**, not a list of unresolved failures. The source links point to the present implementation or evidence. Detailed implementation explanations live in the [completed improvements guide](README.md#understand-the-changes), so there is one place to maintain each explanation.

### Problems found in the earlier backend or test setup

| Finding and effect | Improvement needed | Current status and evidence |
| --- | --- | --- |
| JWT setup could read the signing secret before configuration had loaded. Missing settings prevented startup or tests from reaching the routes. | Load and validate configuration before JWT registration uses it. | Fixed. [JWT configuration test](src/auth/auth.module.spec.ts#L9) and [23 environment cases](src/config/environment.spec.ts#L9) passed; compiled startup passed. Implementation: [AuthModule](src/auth/auth.module.ts#L14) and [environment validator](src/config/environment.ts#L1). |
| The starter E2E test expected `GET /` to return `Hello World!`, but the active AppModule did not expose that route. It also did not prove any Huddle journey. | Replace that E2E assertion with tests of the actual API and a working database fixture. | Replaced. [Core API E2E](test/app.e2e-spec.ts#L12) and the other three E2E files now cover product behavior. The isolated starter unit test still exists and is described below. |
| Private channels were hidden in lists, but an authenticated outsider who knew an ID could request details or members. | Enforce membership on private detail/member reads. | Fixed. [Ten HTTP cases](src/channels/channels.controller.spec.ts#L80) and [real-database private access checks](test/app.e2e-spec.ts#L211) passed. Implementation: [findOneForUser](src/channels/channels.service.ts#L80). |
| Message cursors were validated as UUIDs although stored message IDs are CUIDs. A full final page could also advertise another page that did not exist. | Accept the actual ID type, confirm the cursor belongs to the channel, and fetch one extra row to detect more history. | Fixed. [Six pagination cases](src/messages/messages.service.spec.ts#L22) and [equal-timestamp database pagination](test/app.e2e-spec.ts#L248) passed. Implementation: [query DTO](src/messages/dto/get-messages-query.dto.ts) and [MessagesService](src/messages/messages.service.ts). |
| Two simultaneous signups could both pass the email pre-check. The database rejected the second insert, but its uniqueness error could become a server error. | Turn the expected unique conflict into HTTP 409 while preserving unrelated failures. | Fixed. [Signup service checks](src/auth/auth.service.spec.ts#L35) and [concurrent signup E2E](test/app.e2e-spec.ts#L99) passed: one account and one clear conflict. |
| Logout returned a response without invalidating the already issued token. | Store login sessions, check them on protected requests, and remove the current session at logout. | Fixed. [Session HTTP tests](src/auth/auth.sessions.spec.ts#L99) and [cross-instance logout E2E](test/sessions-invitations.e2e-spec.ts#L64) passed. Another independent login remains valid. |
| Overlong passwords were accepted even though bcrypt ignores bytes beyond its 72-byte boundary. Unicode makes a character-count rule insufficient. | Enforce the same UTF-8 byte ceiling on signup and login. | Fixed. [Ten boundary cases](src/auth/dto/password-validation.spec.ts#L5) and [Unicode password E2E](test/app.e2e-spec.ts#L128) passed. Existing accounts created with overlong passwords need a deployment reset/migration decision. |
| Database E2E work had no reusable isolated setup, and the Prisma adapter needed explicit schema selection. | Use a dedicated test URL, create a fresh schema for each run, route the adapter to it, apply migrations, then clean up only that schema. | Fixed. [Runner](test/run-e2e.mjs#L39), [setup guard](test/setup-e2e.ts#L1) and [PrismaService](src/prisma/prisma.service.ts#L10) support isolation. The final run passed and its schema was independently confirmed absent. |
| The machine's global Node version was below the backend tooling requirement, and dependency advisories were present. | Supply a suitable backend runtime and resolve the affected dependency versions. | Completed. [package.json](package.json) pins a local Node runtime and scoped overrides; build passed and the recorded audit reported zero known vulnerabilities. Audit status must be checked again for a new release. |
| Swagger did not describe the actual message-page wrapper, channel-list membership flag and all invitation responses accurately. | Correct response DTOs and route annotations to match the real API. | Fixed. [Message response DTO](src/messages/dto/message-page-response.dto.ts), [channel list DTO](src/channels/dto/channel-response.dto.ts#L13) and [invitation controller](src/channels/channel-invitations.controller.ts) were reviewed. The generated list/invitation schemas were checked against the compiled app. These are documentation corrections, not evidence that a previously wrong response body was repaired. |

### Additional reliability and usability improvements

These were implementation gaps or protective improvements, rather than a claim that each had already caused a user incident.

| Need | Completed improvement | Evidence and practical effect |
| --- | --- | --- |
| A failed session insert must not leave an account behind after failed signup. | User and session creation use one transaction. | [Actual PostgreSQL rollback and retry](test/session-failure-races.e2e-spec.ts#L83) passed. Without the transaction, partial account creation could make a retry report that the email is already registered. |
| Persistent sessions need lifecycle maintenance. | Startup/hourly expiry cleanup, no overlapping sweeps, safe retry and coordinated shutdown. | [Six cleanup tests](src/auth/session-cleanup.service.spec.ts#L47) passed. Without cleanup, expired sessions stay invalid but their rows accumulate. |
| A private channel needed a route for another registered user to become a member. | Creator invitations, recipient acceptance, expiry, renewal and revocation were added. | [Invitation E2E cases](test/sessions-invitations.e2e-spec.ts#L140) passed. Invitation recipients still share their user ID manually; email delivery and account search were not added. |
| Concurrent invitation changes must not leave duplicate or inconsistent membership. | Transactions, unique constraints and guarded updates protect invitation/acceptance/revocation operations. | [Duplicate and acceptance/revocation scenarios](test/sessions-invitations.e2e-spec.ts#L225) and [four renewal/revocation rounds](test/session-failure-races.e2e-spec.ts#L187) passed. These sample real concurrent outcomes, not every possible schedule. |
| Tests and the running app need consistent input rules. | Shared validation rejects unknown fields and transforms query values; shared middleware supplies headers and an auth request budget. | [HTTP middleware tests](src/configure-app.spec.ts#L44), malformed-input E2E cases and compiled default-budget checks passed. E2E raises the budget for fixtures; the default 20-attempt behavior was checked separately. |
| An API can be running while its database is unavailable. | Separate liveness and readiness routes were added. | [Three health HTTP cases](src/health/health.controller.spec.ts#L28), [database E2E health](test/sessions-invitations.e2e-spec.ts#L59) and compiled checks passed. Readiness returns a sanitized 503 when its database query fails. |
| Repeating local setup should preserve settings and data. | Local PostgreSQL setup/start/stop/status commands and separate development/test roles were added. | Setup rerun, stop/start persistence and role separation were checked during implementation. [Setup instructions](README.md#set-up-a-fresh-environment) explain the repeatable workflow. |

### Missing proof identified when we checked the PRD

The initial review had **83 unit/HTTP cases and 29 E2E cases**. Those checks did not yet directly demonstrate every required journey. The following additions brought the totals to **108 and 38**. Old and new totals are stages of the same suite; they must not be added together.

| Earlier evidence gap | What was added | Current evidence |
| --- | --- | --- |
| Tests sent one person's message to another person, but did not complete a reply and both readers' checks in one scenario. Discovery, explicit login and empty history were also not connected in that journey. | Two accounts sign up and log in; A creates, B discovers and joins; both read empty history; A sends, B replies; both read both messages. | [PRD journey, line 104](test/prd-acceptance.e2e-spec.ts#L104), passed. |
| History for someone joining after messages were already sent lacked a direct assertion. | Send seven messages before B joins; deny early reads; after joining retrieve all seven over pages of 3, 3 and 1. | [Late-join history, line 163](test/prd-acceptance.e2e-spec.ts#L163), passed. |
| A handful of users sending and refreshing together was not directly exercised. | Five members send 20 messages during concurrent refreshes; compare final responses with exact database records and a separate channel. | [Five-member case, line 204](test/prd-acceptance.e2e-spec.ts#L204), passed. This is a functional sample, not a load benchmark. |
| Controlled message-storage failures had limited explicit HTTP evidence. | Deliberately fail send/read/cursor/membership storage operations, and check oversized and unauthorized requests do not write. | [Six message failure cases](src/messages/messages.failures.spec.ts#L81), passed. Storage is mocked; PostgreSQL was not shut down. |
| Mocking a transaction did not establish real database rollback. | Make one actual session insert violate the PostgreSQL foreign key; verify rollback and a successful retry. | [Rollback E2E](test/session-failure-races.e2e-spec.ts#L83), passed. |
| Malformed bearer headers and session-store failures needed clearer boundary tests. | Nineteen guard cases plus malformed/mixed-case header checks through the real database app. | [Guard suite](src/auth/jwt-auth.guard.spec.ts#L34) and [HTTP E2E](test/session-failure-races.e2e-spec.ts#L63), passed. |
| Renewal racing with revocation was transaction-protected but not covered by its own race scenario. | Four fresh concurrent rounds compare responses, stored invitations, pending lists and private access. | [Renewal/revocation cases](test/session-failure-races.e2e-spec.ts#L187), passed. |
| A previous unit setup timed out while heavy E2E work was also running. | Rerun separately; configure E2E files to initialize sequentially while retaining deliberate concurrency within scenarios. | The later full verification passed. Resource contention was a plausible explanation, not a proven cause of the earlier timeout. |

The newer PRD and failure scenarios did not expose new failing service behavior during completion. They supplied missing evidence. The production code corrections in that completion concerned Swagger DTOs and annotations.

## Run the tests yourself

Use PowerShell, including a PowerShell terminal in VS Code. The current machine already has the dependencies, local Node runtime, and database configuration. Run each command separately and wait for it to finish.

### 1. Open the backend directory

```powershell
Set-Location 'C:\Users\Sir. KUKU\OneDrive\Desktop\agile task\Huddle\Backend'
```

On another machine, use the path to its `Backend` folder. All commands below run there.

### 2. Start the local database

```powershell
npm run db:local:start
npm run db:local:status
```

On this machine the status should report `127.0.0.1:53039`. A message saying the database is already running is fine. Starting an existing cluster preserves its data.

### 3. Run the unit and HTTP tests

```powershell
npm test
```

The current suite should finish with:

```text
Test Files  13 passed (13)
     Tests  108 passed (108)
```

These tests exercise individual functions or HTTP routes with controlled database substitutes. They do not need PostgreSQL to be running.

### 4. Run the real-database tests

```powershell
npm run test:e2e
```

The current suite should finish with:

```text
Test Files  4 passed (4)
     Tests  38 passed (38)
Temporary test schema removed.
```

The runner starts the test application itself, so you do not need `npm run start:dev` in another terminal for these automated tests. It uses the dedicated test database, makes its own temporary schema, and removes that schema afterward.

One rollback test deliberately causes a PostgreSQL foreign-key failure. You may see `P2003` and `AuthSession_userId_fkey` in its server log. That test is checking whether a failed signup leaves unwanted data behind. The expected outcome is a sanitized error response, no leftover user/session, a successful retry, and a final **38 passed** result.

### 5. Check code quality, types, build, and dependencies

```powershell
npm run lint
```

Lint checks for code problems identified by the configured linter.

```powershell
npx tsc --noEmit --incremental false -p tsconfig.json
```

Type checking checks TypeScript without generating application output or updating the incremental cache.

```powershell
npm run build
```

The build compiles the backend into `dist`. This matters because tests running TypeScript are not proof that the deployment build succeeds.

```powershell
npm audit
```

The audit checks installed dependencies against known advisories. The last full verification reported zero vulnerabilities. Advisory results can change even when your source does not.

Immediately after an `npm` or `npx` command, check its result with:

```powershell
$LASTEXITCODE
```

`0` means the command succeeded. If a command fails, keep its error output and investigate that failure before treating later results as a complete pass. Lint and type checking may finish with very little output when there is nothing to report.

### 6. Check the running API

```powershell
npm run start:dev
```

Keep that terminal open. In a second PowerShell terminal:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health/live'
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health/ready'
```

Both should return `status: ok`. If startup reports a different API port, use it in these URLs. Press Ctrl+C in the server terminal when finished. That stops the API; it does not delete the database.

### Run one area while investigating

```powershell
npm test -- src/auth/jwt-auth.guard.spec.ts
npm run test:e2e -- -t 'completes signup, login, discovery'
npm run test:e2e -- -t 'lets a later joiner'
npm run test:e2e -- -t 'keeps five members'
```

These are focused checks. Use the complete commands above before calling the whole backend verified. A focused E2E run still gets a fresh isolated schema.

## Understand the test setup

The setup files answer a different question from the feature tests: "Are we testing the real backend in the intended environment?" Their exact implementation and removal consequences are also explained in [the improvements guide](README.md#isolate-end-to-end-tests-from-development-data).

| File and location | Why it belongs here and what it does during a run | What would be lost without it |
| --- | --- | --- |
| [package.json scripts](package.json#L22) | Provides the commands you type. `npm test` invokes the unit suite; `npm run test:e2e` invokes the preparation runner. | Those convenient commands disappear; bypassing preparation would leave the E2E environment incomplete. |
| [vitest.config.ts](vitest.config.ts) | Selects ordinary `*.spec.ts` tests and configures the unit/HTTP runner. | Vitest would need equivalent configuration to discover and execute the intended suite consistently. |
| [test/run-e2e.mjs](test/run-e2e.mjs#L39) | Requires `TEST_DATABASE_URL` from the shell or `.env.test.local`. It creates a random schema, supplies a fresh JWT secret and test mode, generates Prisma Client, applies the checked-in migrations, runs Vitest, then removes its schema. | Database preparation and automatic cleanup would need another implementation. Tests could fail for missing tables or operate in an unintended schema. |
| [test/setup-e2e.ts](test/setup-e2e.ts#L1) | Checks that test mode, the runner's random schema marker and the connection URL agree. | Direct test execution would lose this check against skipping isolation preparation. |
| [vitest.config.e2e.ts](vitest.config.e2e.ts#L6) | Selects E2E files and the setup guard; allows 15 seconds per test and 60 seconds for hooks; runs files sequentially. | Discovery, preparation and timing would need equivalent settings. Concurrent requests explicitly written inside tests would still be separate from file scheduling. |
| [PrismaService schema selection](src/prisma/prisma.service.ts#L10) | Passes the URL's schema into the PostgreSQL adapter. This belongs in shared database initialization because every feature uses that client. | An adapter using a different schema could make the tests query unintended tables even though the runner prepared the right ones. |
| [configureApp](src/configure-app.ts) | Gives test app creation the same input validation and HTTP middleware used by startup. | A passing test could exercise a different validation pipeline from the running server. |
| [E2E fixture lifecycle](test/app.e2e-spec.ts#L12) | Each suite initializes its app and the records needed for its cases, then closes app resources. Some suites also remove their own fixtures; the outer runner removes the complete test schema, including the PRD suite's records. | Cases could lack necessary data, interfere with later checks or leave active app resources. The outer runner still owns schema cleanup. |

An E2E schema is a named collection of tables inside the dedicated test database. The runner removes that collection after the run; it does not remove the whole PostgreSQL installation or the saved development database directory. Use the real dedicated test URL. A variable's name cannot prove that an arbitrary connection string points to a safe database.

The runner prints `Using temporary test schema huddle_e2e_...` and later `Temporary test schema removed.`. A forced process termination, lost database connection or a lock can interrupt cleanup. The printed schema name identifies the run if investigation is needed. The earlier one-off temporary database folder has already been deleted and verified; it is separate from the active `Backend/.local/postgres/data` directory.

No running development API is required for automated E2E tests. Each E2E run starts the app it needs. Running two heavy full suites at the same time makes diagnostics harder, so the walkthrough runs commands one at a time.

## Every test file and what it checks

There are three useful levels of checking here. A unit test focuses on a function or class. An HTTP test exercises request handling while some dependencies can be controlled. A database E2E test builds the real application and uses PostgreSQL. A controlled substitute is often called a **mock**: it lets a test deliberately make one operation fail without taking down your actual database.

The counts below match the current test declarations. `it.each` and `describe.each` expand into separate counted cases. A normal loop inside one test performs several checks but does not increase Vitest's test count.

### The 108 unit and HTTP cases

| Test file | Cases | What is real and what is controlled |
| --- | ---: | --- |
| [app.controller.spec.ts](src/app.controller.spec.ts) | 1 | Isolated starter controller/service; no database. |
| [auth.module.spec.ts](src/auth/auth.module.spec.ts) | 1 | Nest dependency injection and JWT; database dependency replaced. |
| [auth.service.spec.ts](src/auth/auth.service.spec.ts) | 4 | Signup service; Prisma/JWT and transaction behavior controlled. |
| [auth.sessions.spec.ts](src/auth/auth.sessions.spec.ts) | 16 | HTTP, authentication and JWT; session storage simulated. |
| [password-validation.spec.ts](src/auth/dto/password-validation.spec.ts) | 10 | Real DTO validation; no database. |
| [jwt-auth.guard.spec.ts](src/auth/jwt-auth.guard.spec.ts) | 19 | Real guard; JWT verification and session validation controlled. |
| [session-cleanup.service.spec.ts](src/auth/session-cleanup.service.spec.ts) | 6 | Cleanup logic and a Nest lifecycle check; controlled time/database. |
| [channels.controller.spec.ts](src/channels/channels.controller.spec.ts) | 10 | HTTP, guard and channel services; database replaced. |
| [environment.spec.ts](src/config/environment.spec.ts) | 23 | Pure configuration validation. |
| [configure-app.spec.ts](src/configure-app.spec.ts) | 3 | Real HTTP middleware and stub routes; no database. |
| [health.controller.spec.ts](src/health/health.controller.spec.ts) | 3 | Real HTTP health routes; database query controlled. |
| [messages.service.spec.ts](src/messages/messages.service.spec.ts) | 6 | Pagination and DTO validation; database/membership dependencies controlled. |
| [messages.failures.spec.ts](src/messages/messages.failures.spec.ts) | 6 | Real HTTP, guards, services and validation; storage controlled. |
| **Total** | **108** | |

**Starter controller: 1 case.** [The test at line 18](src/app.controller.spec.ts#L18) calls the starter controller and expects `Hello World!`. It remains as isolated class coverage. The active AppModule does not expose that starter controller as `GET /`, so this passing unit test is not evidence that the root HTTP route exists.

**JWT configuration: 1 case.** [auth.module.spec.ts:9](src/auth/auth.module.spec.ts#L9) checks that a secret supplied through `ConfigService` after imports can sign and verify tokens. It protects against reintroducing the early-secret-loading problem.

**Signup service: 4 cases.** [auth.service.spec.ts:35](src/auth/auth.service.spec.ts#L35) onward checks a uniqueness race becomes 409, unrelated database failures are not disguised as duplicates, an existing email is rejected, and a failed session write does not return a successful token response. These tests use a mocked transaction, so actual PostgreSQL rollback is proved separately in E2E.

**Persistent sessions: 16 cases.** [auth.sessions.spec.ts:99](src/auth/auth.sessions.spec.ts#L99) onward checks:

- Current-session logout revokes that login while another remains valid; anonymous logout is rejected.
- Eight malformed-claim cases cover missing/empty/non-string subjects, missing/empty session IDs, and missing/fractional/expired expiry claims.
- A session belonging to another user is rejected; two expiry cases check expired storage and disagreement between token and stored expiry.
- Database failure stays a server error, wrong signing keys/algorithms are rejected, and Passport uses the same session checks.

**Password boundaries: 10 cases.** [password-validation.spec.ts:5](src/auth/dto/password-validation.spec.ts#L5) runs five inputs through each of SignupDto and LoginDto. It accepts 72 ASCII bytes and 18 four-byte emoji; it rejects 73 ASCII bytes, 19 emoji, and 71 ASCII characters followed by the two-byte `é`. These show why the byte limit cannot be replaced by a simple character limit.

**Authorization headers: 19 cases.** [jwt-auth.guard.spec.ts:34](src/auth/jwt-auth.guard.spec.ts#L34) onward checks:

- Twelve absent or malformed headers: no value, empty value, wrong scheme, missing token, trailing/leading whitespace, double space, tab separator, extra token, trailing tab, and combined authorization values.
- Four capitalizations of `Bearer` are accepted when verification and session validation succeed.
- Invalid signatures stop before session lookup; revoked sessions fail; a session-store outage remains an outage rather than becoming a credentials error.

**Session cleanup: 6 cases.** [session-cleanup.service.spec.ts:47](src/auth/session-cleanup.service.spec.ts#L47) onward checks startup cleanup preserves future sessions, hourly repetition uses a fresh cutoff, long sweeps do not overlap, shutdown cancels maintenance, transient failures log safely and retry, and in-flight cleanup finishes before Nest disconnects Prisma.

**Channel visibility: 10 cases.** [channels.controller.spec.ts:80](src/channels/channels.controller.spec.ts#L80) applies the same five checks to channel details and member lists: unauthenticated callers receive 401; private members are allowed; private outsiders receive 403; signed-in public outsiders can discover the resource; missing channels return 404. This is the focused protection against the original privacy leak.

**Environment validation: 23 cases.** [environment.spec.ts:9](src/config/environment.spec.ts#L9) onward checks two required settings; three invalid database URL shapes; one valid/default configuration; one secret byte-boundary case; three accepted modes; four rejected modes; and nine invalid port values. A case can contain several related assertions, such as missing, empty and whitespace-only values for the same required setting.

**HTTP safeguards: 3 cases.** [configure-app.spec.ts:44](src/configure-app.spec.ts#L44) onward checks security headers and removal of the Express signature, a shared signup/login budget with 429 and later reset, and preflight OPTIONS requests not consuming the budget. This test uses a reduced budget of two attempts and a short window; the real default of 20 was checked separately during the compiled production smoke run.

**Health routes: 3 cases.** [health.controller.spec.ts:28](src/health/health.controller.spec.ts#L28) onward checks liveness without database access, readiness after a successful query, and a sanitized 503 after a simulated database failure. The real database success path is also covered in E2E.

**Message pagination: 6 cases.** [messages.service.spec.ts:22](src/messages/messages.service.spec.ts#L22) onward checks CUID acceptance and page-limit conversion, a null cursor on a full final page, the extra-row detection of more history, rejection of a cursor outside the channel, correct continuation after a valid cursor, and membership checks before message queries.

**Message failures: 6 cases.** [messages.failures.spec.ts:81](src/messages/messages.failures.spec.ts#L81) onward deliberately fails writes, history reads, cursor lookups and membership lookups. The HTTP response must be a sanitized server error; a failed read must not invent empty history, and an access-check outage must prevent writing. Two more cases reject a 4,001-character message with 400 and a nonmember with 403, both without a storage write. These tests simulate storage failures; they do not shut down PostgreSQL.

For all these files, removing the tests removes repeatable checks of these behaviors. It does not itself delete the corresponding implementation. Keeping them gives future edits a chance to reveal a regression before release.

### The 38 PostgreSQL end-to-end cases

These four files use the full AppModule, shared HTTP configuration, actual JWT handling and the runner's real PostgreSQL schema.

#### Core API: 19 cases

**File:** [test/app.e2e-spec.ts](test/app.e2e-spec.ts).

| Starting line | What the scenario proves |
| --- | --- |
| [55](test/app.e2e-spec.ts#L55) | Signup stores a bcrypt hash, excludes it from the response, and issues a token usable on `/auth/me`. |
| [68](test/app.e2e-spec.ts#L68) | Registered credentials log in and produce a usable token. |
| [80](test/app.e2e-spec.ts#L80) | Unknown email and wrong password return the same generic error message. It does not test equal response timing. |
| [92](test/app.e2e-spec.ts#L92) | Duplicate signup returns 409. |
| [99](test/app.e2e-spec.ts#L99) | Simultaneous duplicate signups produce one 201, one 409 and one stored user. |
| [115](test/app.e2e-spec.ts#L115) | Five cases reject malformed email, short password, extra admin field, overlong ASCII password and overlong Unicode password. |
| [128](test/app.e2e-spec.ts#L128) | A 72-byte Unicode password works; adding an overlong suffix does not. |
| [145](test/app.e2e-spec.ts#L145) | Two cases protect `/auth/me` and `/channels` from missing/invalid tokens. |
| [156](test/app.e2e-spec.ts#L156) | Channel creation automatically creates the first membership; duplicate channel name returns 409. |
| [173](test/app.e2e-spec.ts#L173) | A guest is denied before joining, can join a public channel, gets 409 on repeat join, and reads an owner's persisted message. This original scenario sends in one direction; the PRD suite below adds the reply. |
| [211](test/app.e2e-spec.ts#L211) | Private channels are absent from an outsider's list and deny direct detail, member, message and join access. |
| [248](test/app.e2e-spec.ts#L248) | Four equal-timestamp messages paginate as two full pages, without missing/duplicate IDs; final cursor is null; a cursor from another channel is rejected. |
| [297](test/app.e2e-spec.ts#L297) | Invalid channel names, empty content, forged sender fields and bad page limits receive 400. |
| [324](test/app.e2e-spec.ts#L324) | Unknown channel detail/member/message routes return 404. |

#### Sessions, invitations and health: 10 cases

**File:** [test/sessions-invitations.e2e-spec.ts](test/sessions-invitations.e2e-spec.ts).

| Starting line | What the scenario proves |
| --- | --- |
| [59](test/sessions-invitations.e2e-spec.ts#L59) | Liveness and readiness work with the real database. |
| [64](test/sessions-invitations.e2e-spec.ts#L64) | Logout through one app instance revokes access through another instance; another login remains valid. |
| [109](test/sessions-invitations.e2e-spec.ts#L109) | A session expired in storage and a legacy token without a session ID are denied. |
| [128](test/sessions-invitations.e2e-spec.ts#L128) | Deleting a user cascades to their session records and invalidates the token. |
| [140](test/sessions-invitations.e2e-spec.ts#L140) | Only a private-channel creator can invite a registered nonmember; extra identity fields and public-channel invitations are rejected. |
| [176](test/sessions-invitations.e2e-spec.ts#L176) | Only the intended recipient sees/accepts the invitation; private message access is denied before acceptance and works afterward. Repeat acceptance and inviting an existing member return 409. |
| [225](test/sessions-invitations.e2e-spec.ts#L225) | Concurrent duplicate invitations and acceptance each produce one success and one conflict, with one membership. |
| [249](test/sessions-invitations.e2e-spec.ts#L249) | An expired invitation is hidden from pending results and returns 410; renewal then acceptance succeeds. |
| [271](test/sessions-invitations.e2e-spec.ts#L271) | Revocation requires the right creator/channel and grants no membership. |
| [297](test/sessions-invitations.e2e-spec.ts#L297) | Acceptance racing with revocation leaves a coherent final membership/invitation outcome without a server error. |

#### Exact Sprint 1 journeys: 3 cases

**File:** [test/prd-acceptance.e2e-spec.ts](test/prd-acceptance.e2e-spec.ts).

1. [The full two-person journey, line 104](test/prd-acceptance.e2e-spec.ts#L104): two accounts sign up and explicitly log in; A creates a channel using only its name; B discovers it in the list, joins, and sees the membership flag change. Both open empty history. A sends, B reads and replies, then both read both messages in order. Stored IDs, senders and content are checked too.
2. [History before joining, line 163](test/prd-acceptance.e2e-spec.ts#L163): A sends seven messages before B joins. B gets 403 before joining, then reads all seven in pages of 3, 3 and 1. Exact content/order, unique IDs, fresh cursors and the final null cursor are asserted.
3. [Five-member conversation, line 204](test/prd-acceptance.e2e-spec.ts#L204): five independent members send 20 messages while refreshing concurrently. Twenty intermediate and five final shared-channel refreshes check delivery; each final response contains all messages with correct fields, and PostgreSQL contains exactly 20 rows. Another channel retains only its separate message.

These were added because the initial review found missing acceptance evidence. A passing single-direction send/read test was not enough to demonstrate a reply and both participants seeing the full conversation. The five-member case is a local functional concurrency sample, not a production capacity benchmark.

#### Session failure and invitation races: 6 cases

**File:** [test/session-failure-races.e2e-spec.ts](test/session-failure-races.e2e-spec.ts).

- [Line 63](test/session-failure-races.e2e-spec.ts#L63): real HTTP rejects malformed headers and accepts a mixed-case Bearer scheme.
- [Line 83](test/session-failure-races.e2e-spec.ts#L83): narrowly scoped fault injection changes one session insert to reference a nonexistent user. PostgreSQL itself rejects it with `P2003`. The test proves the intended user existed inside the real transaction, then proves that user and session did not persist, and finally verifies that retry succeeds with a usable login.
- [Line 187](test/session-failure-races.e2e-spec.ts#L187): four fresh rounds run invitation renewal and revocation concurrently. Both requests produce their expected responses; database rows and pending lists agree with whichever valid operation order occurred. No membership is granted, and private message reads remain forbidden.

The rollback test retains the actual PostgreSQL transaction and constraint. Its fault injection is a way to reach the failure on purpose, not a replacement for database behavior. The race rounds check the outcomes they exercise; they do not prove every possible scheduling order.

## Read the final results correctly

| Verification from 12 September 2026 | Recorded result | What it establishes |
| --- | --- | --- |
| `npm test` | 108 passed, 13 files, exit 0; 28.57 seconds. | The unit/HTTP cases above passed. |
| `npm run test:e2e` | 38 passed, 4 files, exit 0; 26.84 seconds in Vitest, excluding runner preparation. | The listed flows worked against real PostgreSQL and the temporary schema was removed. |
| Lint, type checking and build | All passed. | Configured code checks passed and the application compiled. |
| `npm audit --json` | Zero known vulnerabilities at that time. | No installed dependency advisory was reported by that audit. |
| Compiled development startup | Liveness/readiness 200; generated Swagger 200. | The built app starts, reaches the database, and publishes the expected API documentation outside production. |
| Generated OpenAPI inspection | Correct list-only required boolean `isMember`; all four invitation response sets matched. | The documentation corrections are present in generated output, not only in source annotations. |
| Compiled production startup | Liveness/readiness 200; both Swagger URLs 404; HSTS present. | Production startup uses the intended route/header settings. |
| Default authentication limit | First 20 malformed login attempts returned 400; the 21st returned 429 with retry information. | The compiled server enforces the default auth request budget. |
| Database cleanup and file state | Completed schema absent; old temporary folder absent; current source/data present; local PostgreSQL running. | Test cleanup did not remove the current development setup. |
| Other earlier setup checks | Local setup rerun preserved settings, stop/start preserved data, dev/test permissions were separated, and Prisma schema diff reported no drift. | These setup behaviors were checked during implementation; they are not extra cases included in the 146 count. |

The full verification ran locally on Windows, Node 24.15.0, PostgreSQL 18, and an Intel Core i7-8665U with eight logical processors. The durations are whole-suite observations, not response-time commitments. Temporary API processes used for smoke checks were stopped afterward.

The earlier review had 83 unit/HTTP and 29 E2E cases. The additions increased those counts to 108 and 38; do not add the old totals to the new totals. There is no recorded coverage percentage, and a test count is not a percentage of all possible bugs.

An earlier unit setup timed out while heavy E2E work was running alongside it; a separate rerun passed. The later full verification above passed without that timeout. Vite may still print an informational note about native TypeScript path resolution; the configured resolver worked in these checks. A `P2003` in some other context should be investigated—the expected one is the deliberately triggered rollback test described above.

## Work through an error

First find the failing command, test title and assertion. An assertion tells you what result the test expected and what it actually received. Keep that output, including the first relevant error above the summary. Then use the matching row below. A later passing command does not erase an earlier failure.

| What you see | What it usually means here | What to do next |
| --- | --- | --- |
| `Set TEST_DATABASE_URL...` | The E2E runner has no dedicated test connection setting. | Follow [fresh setup](README.md#set-up-a-fresh-environment), then use `npm run test:e2e`. Local setup creates `.env.test.local`; it deliberately does not fall back to the development URL. |
| `TEST_DATABASE_URL must be a PostgreSQL connection URL...` | The supplied URL is incomplete or has the wrong scheme. | Check the format against [the test example](.env.test.example). Keep the actual credentials private. A shell setting takes precedence over the file setting. |
| Connection refused, connection timeout or database authentication failure | PostgreSQL is stopped, the saved host/port is wrong, or the supplied role/password is not accepted. These are different from a failed application assertion. | Run `npm run db:local:status`, start the saved cluster if stopped, and confirm the connection file describes that cluster. On this machine its recorded port is 53039. For a separately managed database, check that server instead. |
| Missing or invalid `JWT_SECRET` / `DATABASE_URL` at API startup | Required application configuration did not pass validation. | Follow [configuration loading](README.md#load-configuration-before-authentication-needs-it). Development loads the local files; explicit test/production modes do not. A production process needs its settings supplied by its host. Normal E2E execution supplies its own random JWT secret. |
| `Run E2E tests with npm run test:e2e...` | Vitest was started without the isolation runner or its expected schema marker. | Use `npm run test:e2e` rather than invoking the E2E Vitest configuration directly. The guard is working as intended. |
| A migration fails or a required table is missing | Schema preparation did not complete, the connected role lacks the necessary permission, or the connection/schema is wrong. | Read the migration error first. E2E applies migrations automatically; a new development environment needs the migration step in [setup](README.md#set-up-a-fresh-environment). Check the intended database and schema before changing anything. |
| `P2003` with `AuthSession_userId_fkey` in the rollback scenario | That scenario deliberately inserts an invalid foreign key to test real transaction rollback. | It is expected only when that named rollback case passes, retry succeeds and the full summary is **38 passed**. Investigate the same error in any other scenario. |
| A setup/hook timeout | Application/database initialization exceeded that test's configured time allowance. | Run the failing suite by itself and inspect startup/database output. If it repeats, investigate that failure; increasing the timeout alone does not establish correctness. The old one-off timeout was followed by a clean separate run and a later full pass. |
| A native TypeScript path-resolution informational note from Vite | The tool is advertising an available resolution option. | It did not fail the recorded run. Read the actual summary and exit code before treating the note as a failure. |
| 401 during a manual protected request | The bearer token is absent, malformed, expired, revoked or no longer matches a stored session. | Log in again and use that response's token as one `Authorization: Bearer <token>` value. Old tokens issued before persisted sessions were added require a new login. |
| 403 on a message route | The signed-in caller is not a channel member. | Join the public channel, or accept the intended private invitation, then retry as that same user. Knowing the channel ID does not grant membership. |
| 409 on signup/join/invitation | The operation conflicts with an existing account, membership or invitation. | Read the response and check whether the operation already succeeded. For a fresh manual signup exercise use a different unused test email. Do not treat every 409 as a server fault. |
| 429 on repeated signup/login | The shared authentication budget has been used. | Wait for the response's retry interval and try again. The real default is 20 auth POST requests per minute per IP per app process. |
| Liveness succeeds but readiness returns 503 | The process can handle HTTP, but its database readiness query failed. | Check PostgreSQL availability and the API's database configuration. The response is intentionally sanitized; detailed diagnosis belongs in server/database output. |
| Tests pass but there is no cleanup success message, or the runner exits nonzero | Test assertions and runner cleanup are different stages. The run is not fully successful if cleanup failed. | Keep the printed `huddle_e2e_...` schema name and cleanup error. Investigate that exact schema on the dedicated test database after the run has stopped. Do not remove the active local database directory to fix a leftover test schema. |

If a unit/HTTP test fails, reproduce the named file with `npm test -- path/to/file.spec.ts`. If an E2E case fails, use the `npm run test:e2e -- -t 'part of the case name'` form shown above. After a fix, rerun the focused check and the complete verification sequence before recording a new full pass.

## Try a conversation with another person

The automated two-account conversation passed. The PRD also asks for two real people to complete a conversation. This exercise lets you record that human result using the backend alone.

Use three PowerShell terminals on this machine: one runs the server, one belongs to person A, and one belongs to person B. The exercise creates ordinary test accounts and a public channel in the development database. Unlike E2E fixtures, those records remain afterward; the exercise does not reset the database.

### Start the server

In the server terminal, from `Backend`:

```powershell
npm run db:local:start
npm run start:dev
```

The following URLs assume port 3000. Use the port printed by startup if it is different.

### Each person signs up and logs in

Each person runs this in their own terminal with a different fresh test email. The password prompt hides input, and tokens are kept in that terminal's variables.

```powershell
$huddleBase = 'http://127.0.0.1:3000'
$huddleEmail = Read-Host 'Your fresh test email'
$huddleSecret = Read-Host 'Test password: at least 8 characters, at most 72 UTF-8 bytes' -AsSecureString
$huddleCredential = [System.Management.Automation.PSCredential]::new($huddleEmail, $huddleSecret)
$huddleCredentialsJson = @{
  email = $huddleEmail
  password = $huddleCredential.GetNetworkCredential().Password
} | ConvertTo-Json
$huddleSignup = Invoke-RestMethod -Method Post -Uri "$huddleBase/auth/signup" -ContentType 'application/json' -Body $huddleCredentialsJson
$huddleLogin = Invoke-RestMethod -Method Post -Uri "$huddleBase/auth/login" -ContentType 'application/json' -Body $huddleCredentialsJson
$huddleHeaders = @{ Authorization = "Bearer $($huddleLogin.token)" }
$huddleCredentialsJson = $null
$huddleCredential = $null
$huddleSecret = $null
$huddleSignup = $null
$huddleLogin = $null
Invoke-RestMethod -Uri "$huddleBase/auth/me" -Headers $huddleHeaders
```

The two POST requests exercise account creation and explicit login. The header variable carries the login token to protected requests. Clearing the other variables avoids leaving unnecessary password/token copies in the exercise. The final GET should show that person's ID and email. Signup and explicit login create separate sessions; the logout step below revokes the login token being used in this terminal.

### Person A creates the channel

```powershell
$huddleChannelName = 'trial-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$huddleChannel = Invoke-RestMethod -Method Post -Uri "$huddleBase/channels" -Headers $huddleHeaders -ContentType 'application/json' -Body (@{ name = $huddleChannelName } | ConvertTo-Json)
$huddleChannelId = $huddleChannel.id
$huddleChannel | Select-Object id, name, memberCount
```

The result should show one member: the creator. Person A tells B the channel name. B uses their own authentication token throughout the exercise.

### Person B discovers and joins it

```powershell
$huddleChannelName = Read-Host 'Channel name from person A'
$huddleChannels = Invoke-RestMethod -Uri "$huddleBase/channels" -Headers $huddleHeaders
$huddleChannel = $huddleChannels | Where-Object { $_.name -eq $huddleChannelName }
if (-not $huddleChannel) { throw 'Channel was not found in the available list.' }
$huddleChannel | Select-Object id, name, isMember
$huddleChannelId = $huddleChannel.id
Invoke-RestMethod -Method Post -Uri "$huddleBase/channels/$huddleChannelId/join" -Headers $huddleHeaders
Invoke-RestMethod -Uri "$huddleBase/channels/$huddleChannelId/messages" -Headers $huddleHeaders
```

B should initially see `isMember = False`. Joining should succeed, and this new channel's history should have an empty `messages` array and a null cursor.

### A sends, B refreshes and replies, then both read

Person A runs:

```powershell
Invoke-RestMethod -Method Post -Uri "$huddleBase/channels/$huddleChannelId/messages" -Headers $huddleHeaders -ContentType 'application/json' -Body (@{ content = 'Hello B, can you read this?' } | ConvertTo-Json)
```

Person B runs:

```powershell
(Invoke-RestMethod -Uri "$huddleBase/channels/$huddleChannelId/messages" -Headers $huddleHeaders).messages | Select-Object senderId, content, createdAt
Invoke-RestMethod -Method Post -Uri "$huddleBase/channels/$huddleChannelId/messages" -Headers $huddleHeaders -ContentType 'application/json' -Body (@{ content = 'Yes A, I can read it. Here is my reply.' } | ConvertTo-Json)
```

Now both people run:

```powershell
(Invoke-RestMethod -Uri "$huddleBase/channels/$huddleChannelId/messages" -Headers $huddleHeaders).messages | Select-Object senderId, content, createdAt
```

Both should see A's message followed by B's reply, with the correct different sender IDs. Repeating GET is the refresh behavior agreed for Sprint 1.

### Finish and record the human result

Each person can revoke the current login:

```powershell
Invoke-RestMethod -Method Post -Uri "$huddleBase/auth/logout" -Headers $huddleHeaders
$huddleHeaders = $null
```

Record the date, channel name, whether both people saw both messages in order, and any error. Keep passwords and tokens out of that record. Preparing this exercise is not the same as two people completing it; the human trial had not been recorded at the latest verification.

## Understand what remains outside these checks

The recorded tests demonstrate the local backend scenarios listed here. They do not establish that every possible failure has been eliminated. At the latest verification, the identified backend fixes and automated acceptance additions were complete; the items below describe remaining human or environment checks and bounded improvement needs.

| Item | Current status | Next action and reason |
| --- | --- | --- |
| A conversation completed by two actual people | Not recorded at the latest verification. Automated accounts passed, but they cannot stand in for a human trial. | Follow [the exercise above](#try-a-conversation-with-another-person) and record whether each person sees both messages in order. This supplies the remaining human acceptance evidence. |
| Hosted deployment and real network behavior | Local compiled development/production checks passed; no hosted release was verified. | Follow [deployment preparation](README.md#prepare-a-deployment), then verify migrations, health, authentication and a conversation in the chosen environment. |
| TLS, trusted proxies and limiting across multiple app instances | The current auth limiter is held in each app process; hosting-specific ingress behavior was not tested. | Configure the chosen host's HTTPS/proxy behavior. If multiple instances must share one auth budget, use a shared limiter store and verify the client-IP behavior there. |
| Database backup and restoration | Local stop/start persistence passed; recovery from a backup was not demonstrated. | Create and restore a backup in a suitable separate environment, then verify application data and routes. Restarting a database is different from proving restoration. |
| Larger channel and pending-invitation lists | Both currently return all matching results without pagination. Five-member messaging passed, but large-list performance was not measured. | If expected data grows beyond the sprint's small group, add pagination and test boundaries, ordering and larger realistic data volumes. |
| Sustained load and response-time targets | No production capacity/latency benchmark was recorded. Suite durations are not request latency promises. | Define expected concurrent users, message rate and response-time goals before doing a load test against representative infrastructure. |
| Previously created overlong-password accounts | New signup/login enforce 72 UTF-8 bytes; existing password hashes were not rewritten. | Before deploying where such accounts exist, choose and carry out a reset/migration plan so affected users are not unexpectedly locked out. |
| Invitation usability | Creator invites an existing user ID. No account-search endpoint, email invitation or delivery notification was added. | Keep the shared-ID workflow for the current scope; decide on discovery/delivery behavior before expanding the feature. |
| First-try completion and time to first message | Suggested PRD metrics have no recorded instrumentation or committed numeric target. | Define the target and measurement method if those metrics are required for the human trial or a later release. |
| Email verification and larger product features | Email verification remains an undecided policy. Workspaces, profiles, direct messages, uploads, video and notifications are outside this sprint. | Decide scope before treating any of these as required backend changes. Refresh-based delivery already matches the agreed Sprint 1 behavior. |
| Frontend and browser behavior | Excluded at the user's request. | This backend report makes no claim about rendering, browser token storage or user-visible client error presentation. |

The message-storage failures are simulated in focused HTTP tests; they are not a whole-database outage drill. The real signup rollback scenario deliberately triggers one constraint failure, and the invitation races exercise their observed concurrent orders. Broader outage behavior and every possible scheduling order are not proved by those cases.

There is no recorded coverage percentage. There was no full issue-tracker review, and passing 146 tests is not a certificate that there are no other bugs. The useful conclusion is precise: the named assertions and supporting checks passed in the recorded environment.

## Record the next verification

Use a dated record when you run the checks yourself. Keep the test counts separate from lint/build/audit results, and distinguish an expected failure-path response from a failed assertion. Copying the table below does not mean a new run has happened.

| Field | Record from your actual run |
| --- | --- |
| Date and machine/environment | Fill in after running. |
| Code version or changes tested | Commit ID if available, plus relevant uncommitted changes. |
| Unit/HTTP result | Passed/failed files and cases, plus exit code. |
| PostgreSQL E2E result | Passed/failed files and cases, plus exit code. |
| E2E cleanup | Whether the runner printed its cleanup success message; keep the schema name if cleanup failed. |
| Lint and type checking | Each command's result. |
| Build and dependency audit | Each command's result; date the audit. |
| Running API | Liveness/readiness and any manual behavior checked. |
| Human conversation | Date, channel, both participants' observed message order, and any error. |
| Follow-up | Failing test title/error, proposed fix, and rerun result. |

Keep passwords, tokens and database connection strings out of shared records. After a source change, use the relevant focused test while working and the complete sequence before reporting another full backend verification. The companion [improvements README](README.md) is where the final implementation explanation belongs.
