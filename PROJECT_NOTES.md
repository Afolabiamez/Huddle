# Project Notes — how this was built, and why

This document walks through the steps taken to turn a single-file demo into
a real, structured React project. It's written as a guide: each step names
the rule being followed and why that rule earns its place, so the reasoning
is reusable on your next project even where the code isn't.

---

## Why this rewrite happened

The previous version was a single `.jsx` file — every screen, every helper
function, and all the mock data lived in one place. That's fine for a
five-minute demo, but it breaks down fast:

- You can't find anything without scrolling past everything else.
- Every component was tangled with inline styles referencing a shared
  `COLORS` object, so the "design system" and the "component logic" were
  never actually separable.
- Navigation was a hand-rolled `useState("screen")` variable, which has no
  browser back-button support and no shareable URLs — acceptable inside a
  sandboxed demo, wrong for anything real.

The rewrite fixes all three by applying one general principle throughout:
**separate code by what it's responsible for, not by what's convenient to
write in the moment.**

---

## Step 1 — Scaffold with a real tool (Vite)

**What:** `npm create vite@latest huddle-frontend -- --template react`

**Rule:** don't hand-write build configuration you can get for free from a
maintained tool. Vite gives you a dev server, a bundler, and JSX support
that thousands of other projects already rely on and have found the bugs
in. Writing your own webpack config from scratch is a classic way to burn
a day on something that has nothing to do with your actual app.

## Step 2 — Install the dependencies the environment actually needs

**What:** `react-router-dom` for navigation, `tailwindcss` +
`@tailwindcss/postcss` + `postcss` + `autoprefixer` for styling.

**Rule:** match the tool to the environment you're actually shipping to.
The previous hand-rolled router was a workaround for a sandbox that
couldn't install packages — once that constraint is gone, keeping the
workaround would just be carrying forward a limitation you no longer have.

## Step 3 — Centralize design tokens

**What:** `src/index.css` defines a Tailwind v4 `@theme` block with every
color and font used in the app (`--color-primary`, `--color-ink`,
`--font-heading`, etc.), instead of a JS object imported into every file.

**Rule:** a design system should be a shared vocabulary, not a value copied
into wherever it's needed. With tokens defined once, a component writes
`className="text-ink"` instead of `style={{ color: COLORS.ink }}` — and if
the brand color ever changes, it's a one-line edit instead of a
find-and-replace across a dozen files.

## Step 4 — Plan the folder structure before writing files

**What:**

```
src/
  api/         "How do we talk to the backend?"
  context/     "Where does shared app state live?"
  hooks/       "How do components read that shared state?"
  data/        "What does the app look like on first load?"
  utils/       "What small logic gets reused everywhere?"
  components/  "What small UI pieces get reused across screens?"
  screens/     "What does one full page look like?"
  routes/      "Who's allowed to see this page?"
```

**Rule:** every folder should answer exactly one question. If you can't
say in one sentence what a folder is *for*, it's probably a dumping
ground rather than a real category — and dumping grounds are where bugs
hide, because nothing about the location tells you what the code does.

## Step 5 — Build the bottom of the dependency tree first

**What:** `utils/helpers.js` (pure functions, no React) and
`data/seedData.js` (fake starting data) were written before anything that
depends on them.

**Rule:** build in dependency order, not visual order. Everything else in
the app eventually imports from these two files. Writing them first means
every subsequent file can import something that already exists and works,
instead of guessing at an interface you'll define three files from now.

## Step 6 — Build the "pretend backend" as its own layer

**What:** `api/mockApi.js`. Every exported function (`signUp`, `login`,
`fetchChannels`, `createChannel`, `joinChannel`, `sendMessage`) is `async`,
returns a Promise, and can reject/fail — exactly like a real `fetch()` call
would.

**Rule — this is the most important one in the project:** code that
pretends to be a network call should be indistinguishable, from the
caller's point of view, from a real one. Because every screen calls these
functions the same way it would call a real API, replacing the *inside* of
this one file with real HTTP requests later requires touching nothing
else. This is the seam where "demo" becomes "production."

It's also where the PRD's specific acceptance criteria are enforced at the
source rather than in the UI:
- Duplicate email on signup → a specific, clear rejection message.
- Wrong email OR wrong password on login → the exact same generic message
  either way, so the UI has no way to accidentally leak which field was
  wrong (a screen can't leak information it never receives).
- Message sending has a simulated ~8% failure rate, so the "show a clear
  error on failure, never fail silently" quality-bar requirement is
  actually exercised, instead of being an error path that's never tested
  because it's never triggered.

## Step 7 — Build the shared state layer (Context + a custom hook)

**What:** `context/AppContext.jsx` holds `currentUser` and `channels` in
React state, and exposes actions (`login`, `signUp`, `sendMessage`, etc.)
that call into `mockApi`. `hooks/useApp.js` wraps `useContext` so
components never import the context directly.

**Rule:** don't pass state through five layers of components just so the
sixth one can use it ("prop drilling"). A screen three levels deep in the
tree can call `useApp()` and get exactly what it needs, with no component
in between having to know or care.

**Sub-rule — always wrap `useContext` in a custom hook.** If `useApp()` is
called outside `<AppProvider>`, it throws an immediate, readable error
("useApp() must be used inside <AppProvider>") instead of a confusing
`Cannot read properties of null` several calls later. Small thing, saves
real debugging time.

This layer is also where **optimistic sending** lives: a message appears
in the UI the instant you hit send (marked `pending`), and is only
reconciled to "confirmed" or "failed" once the simulated request resolves.
This is what makes the app feel instant despite the artificial network
delay, while still leaving room for a real failure state.

## Step 8 — Build small, reusable components

**What:** `components/Avatar.jsx`, `Banner.jsx`, `PrimaryButton.jsx`,
`ChannelListItem.jsx`, `MessageBubble.jsx`.

**Rule:** if two or more screens would otherwise duplicate a piece of UI,
it belongs in `components/`, not copy-pasted. In the single-file version,
the button and error-banner markup was repeated near-identically in three
places — any styling fix would have meant finding and editing all three by
hand, with no guarantee you'd catch every copy.

## Step 9 — Build the route guard

**What:** `routes/RequireAuth.jsx` — a wrapper that redirects to `/auth` if
`currentUser` is `null`.

**Rule:** access control is a cross-cutting concern (it applies to
multiple, unrelated screens), so it gets written once as a wrapper rather
than pasted into the top of every protected screen. This is also a direct,
literal implementation of a PRD requirement: Story 1 says a person "stays
logged in until they log out" — the flip side of that promise is that a
logged-*out* person should never be able to land on a page meant for
logged-in users, which is exactly what this component enforces.

## Step 10 — Build the screens

**What:** one file per URL — `OnboardingScreen`, `AuthScreen`,
`ChannelListScreen`, `CreateChannelScreen`, `ChannelViewScreen`.

**Rule:** a screen owns layout and user interaction for exactly one page,
and reads/writes state only through `useApp()` — never by calling
`mockApi` directly. This is the payoff of every step before this one: each
screen file is short and readable, because the hard logic (auth rules,
optimistic updates, failure handling) already lives in the context layer,
not scattered across every page that happens to need it.

## Step 11 — Wire it together: routes and entry point

**What:** `App.jsx` declares the URL-to-screen map and which routes sit
behind `RequireAuth`. `main.jsx` mounts the app inside `BrowserRouter` and
`AppProvider`.

**Rule:** `App.jsx` should be readable as a table of contents. If you can't
tell what pages an app has by skimming this one file top to bottom, routing
logic has leaked into places it shouldn't be.

One detail worth noting: `BrowserRouter` wraps `AppProvider` in `main.jsx`,
not the other way around — because screens inside `AppProvider` use router
hooks like `useNavigate()`, which only work if a `BrowserRouter` is already
above them in the tree. Provider order isn't arbitrary; it follows what
depends on what.

## Step 12 — Verify the build before calling it done

**What:** `npm run build`, then `npm run preview` to serve the built output
and confirm it actually responds.

**Rule:** never hand off code you haven't run. A clean build catches import
typos, missing files, and JSX mistakes that are easy to miss just reading
the code — the gap between "this should work" and "this does work" is
exactly the gap this step closes.

## Step 13 — Write the README

**Rule:** a project isn't finished until someone else (or you, in six
months) can get it running without asking you how. Two commands
(`npm install`, `npm run dev`) plus a demo login is the minimum bar.

---

## Mapping back to the PRD

| PRD Story | Where it lives |
|---|---|
| Story 1 — Sign up & sign in | `screens/AuthScreen.jsx` (UI) + `api/mockApi.js` (`signUp`, `login` — this is where the generic-error and duplicate-email rules are actually enforced) + `routes/RequireAuth.jsx` (session persistence/gating) |
| Story 2 — Create/join a channel | `screens/ChannelListScreen.jsx`, `screens/CreateChannelScreen.jsx`, `components/ChannelListItem.jsx` |
| Story 3 — Send/read messages | `screens/ChannelViewScreen.jsx` (scrollback via "Load earlier messages", composer) + `context/AppContext.jsx` (`sendMessage` — optimistic UI + failure handling) + `components/MessageBubble.jsx` |
| Quality bar: "clear message on failure, never silent" | `components/Banner.jsx` (form-level errors) + `components/MessageBubble.jsx`'s failed state + retry |

## What's intentionally still fake

- **No real backend.** `api/mockApi.js` holds everything in memory; a
  refresh loses all new signups/channels/messages (seed data comes back).
  Swapping this for real HTTP calls is the next real step, and it should
  only touch this one file.
- **No real-time messaging.** Messages only update when this browser tab
  sends one. There's no second real user to talk to yet — that's a
  decision to make once a backend exists (see the open question in the
  PRD about real-time vs. refresh-based updates).
- **Workspaces, private/public channel permissions, member invites,
  message reactions, threads, and direct messages** are all out of scope
  for this sprint per the PRD, and aren't built here at all — not even as
  disabled UI — to avoid implying functionality that doesn't exist.
