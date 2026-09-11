# Huddle — Sprint 1 Frontend

A small team-messaging app. This covers Sprint 1's scope only: account
creation, sign-in, and channel messaging (see PROJECT_NOTES.md for the
full reasoning behind what's included, what's deliberately left out, and
how the real backend was wired in).

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Backend

This app talks to a real backend by default:

```
VITE_API_BASE_URL=https://huddle-backend-xblp.onrender.com
```

This is already set in `.env` (see `.env.example` for the template). A few
things worth knowing:

- **Cold starts:** the backend is hosted on Render's free tier, which
  spins down when idle. The first request after a period of inactivity can
  take up to ~50 seconds to respond — this is expected, not a bug. The app
  waits up to 60 seconds before showing a "server is waking up" message.
- **No backend? No problem.** Delete or rename `.env` (or unset
  `VITE_API_BASE_URL`) and the app automatically falls back to a built-in
  in-memory mock backend — useful for UI work when the real API is slow or
  unavailable. See `src/api/index.js`.
- **Unverified contract:** the real API's exact endpoint shapes weren't
  confirmed before integration (see PROJECT_NOTES.md's addendum). If
  something doesn't work end-to-end, the two files most likely to need a
  fix are `src/api/realApi.js` (endpoint paths) and `src/api/normalize.js`
  (field names in the response).

## Try it (mock backend)

If running against the mock (no `VITE_API_BASE_URL` set):
- Sign up with any email/password, OR
- Log in with a pre-seeded account: `demo@huddle.com` / `password123`

Against the real backend, use whatever account creation flow the backend
actually supports (sign up fresh — the demo account above only exists in
the mock).

## Project structure

See PROJECT_NOTES.md for the full walkthrough of why the code is organized
this way, folder by folder, plus a step-by-step log of how it was built.
