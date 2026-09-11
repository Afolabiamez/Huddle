# Huddle — Frontend/Backend API Contract (Sprint 1)

The frontend can run two ways:

- **Mock mode** (`src/api/mockApi.ts`) — a `localStorage`-backed
  implementation of `HuddleApi` (`src/api/types.ts`). Fully working
  standalone, no backend needed. This is the default when no backend URL
  is configured.
- **Real mode** (`src/api/httpApi.ts`) — an HTTP client that calls the
  endpoints below.

`src/api/client.ts` picks between them automatically based on the
`VITE_API_BASE_URL` env var (see `.env` / `.env.example`), so no page
component ever imports the mock or HTTP client directly — they all import
from `src/api/client.ts`.

Currently pointed at the deployed backend:
`https://huddle-backend-xblp.onrender.com` (set in `.env`).

**Auth mechanism:** the HTTP client sends `credentials: "include"` (cookie
session) on every request, and additionally caches an optional `token`
field from the signup/login response and sends it as
`Authorization: Bearer <token>`. If the backend uses a different
mechanism (e.g. a differently-named token field, or a header other than
`Authorization`), tell the frontend and this is a one-file change in
`src/api/httpApi.ts`.

## Auth

### POST /auth/signup
Request: `{ "email": string, "password": string }`
Success 201: `{ "id": string, "email": string }` (+ sets session cookie/token)
Errors:
- 409 `{ "code": "EMAIL_TAKEN", "message": "..." }` — email already registered
- 400 `{ "code": "INVALID_INPUT", "message": "..." }`

### POST /auth/login
Request: `{ "email": string, "password": string }`
Success 200: `{ "id": string, "email": string }` (+ sets session cookie/token)
Errors:
- 401 `{ "code": "INVALID_CREDENTIALS", "message": "..." }`
  — **generic message only**, never reveal whether the email or the password
  was wrong (PRD Story 1 acceptance criteria).

### POST /auth/logout
Success 200: clears session.

### GET /auth/me
Success 200: `{ "id": string, "email": string }`
Success 200 (not logged in): `null` (or 401 — frontend treats either as "no user")

## Channels

### GET /channels
Success 200: `Channel[]` where
`Channel = { id, name, createdAt, memberIds: string[] }`

### POST /channels
Request: `{ "name": string }`
Success 201: `Channel`
Errors: 409 `CHANNEL_EXISTS` if name taken, 400 `INVALID_INPUT` if empty.

### POST /channels/:id/join
Success 200: `Channel` (with the current user added to `memberIds`)
Errors: 404 `NOT_FOUND`

### GET /channels/:id
Success 200: `Channel`
Errors: 404 → frontend expects `null`, not an exception, to show "channel doesn't exist" state.

## Messages

### GET /channels/:id/messages
Success 200: `Message[]` sorted oldest → newest, where
`Message = { id, channelId, authorId, authorEmail, text, createdAt }`

### POST /channels/:id/messages
Request: `{ "text": string }`
Success 201: `Message`
Errors:
- 400 `INVALID_INPUT` if text empty
- 401 `NOT_AUTHENTICATED` if no session

## Live updates (Open Question in PRD Section 12)

The mock uses short polling (every 2s) plus a same-browser `storage` event
as a stand-in for real-time. If the backend doesn't have WebSockets/SSE
ready this sprint, **polling `GET /channels/:id/messages` every 2–3s is
fine** and requires zero frontend changes — this is already how it works
today. If you do add real-time push later, only `ChannelPage.tsx`'s
`useEffect` needs to swap `setInterval` for a socket subscription.

## Error shape

All errors should come back as `{ "code": string, "message": string }`
with an appropriate HTTP status, matching `ApiError` in `src/api/types.ts`
(`code` + human-readable `message`). The frontend shows `message` directly
to the user, so keep it plain-language and non-technical.
