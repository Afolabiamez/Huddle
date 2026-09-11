# Huddle — Sprint 1 Frontend

A small team-messaging app. This covers Sprint 1's scope only: account
creation, sign-in, and channel messaging (see PROJECT_NOTES.md for the
full reasoning behind what's included and what's deliberately left out).

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Try it

- Sign up with any email/password, OR
- Log in with a pre-seeded account: `demo@huddle.com` / `password123`

## What's real vs. what's mocked

There is no backend yet. `src/api/mockApi.js` simulates one entirely in
memory (data resets on every page refresh). Every function in that file is
written to look and behave like a real network call (it's `async`, it can
reject/fail) specifically so that swapping in real `fetch()` calls later is
a change contained to that one file — no screen or component should need
to change.

## Project structure

See PROJECT_NOTES.md for the full walkthrough of why the code is organized
this way, folder by folder.
