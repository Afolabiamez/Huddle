# Huddle — Frontend

Sprint 1 frontend: sign up / log in, create or join a channel, send and read
channel messages. Built with React + Vite + TypeScript.

## Running it

```bash
npm install
npm run dev
```

Open the printed local URL in two separate browser tabs to try it as "two
different users" — signup as a different email in each tab, join the same
channel, and send messages back and forth.

## Status

The UI is fully working right now against a **mock API** backed by
`localStorage` (see `src/api/mockApi.ts`) — no backend is required to try
it out or demo it. See `API_CONTRACT.md` for the exact endpoint shapes the
backend should implement so we can swap the mock for real API calls with
minimal changes.

## Structure

- `src/api/` — `HuddleApi` interface (`types.ts`) + the mock implementation
- `src/context/AuthContext.tsx` — current-user state
- `src/components/` — `TopBar`, `ProtectedRoute`
- `src/pages/` — `SignupPage`, `LoginPage`, `ChannelsPage`, `ChannelPage`

## Covers (PRD Sprint 1, Stories 1–3)

- Sign up / log in, duplicate-email block, generic wrong-credentials error, persisted session
- Create a channel, list channels, join a channel
- Send/read messages in order, scrollback after refresh, two-way exchange between users
- Loading, empty, and error states throughout
