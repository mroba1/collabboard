# CollabBoard

A real-time collaborative whiteboard: infinite pan/zoom canvas, freehand drawing, shapes, arrows, sticky notes, text and images, live multi-user presence with cursors, PNG/PDF export, and an embedded AI assistant that reads the board and can summarize it, answer questions, suggest next steps, and generate editable diagrams straight onto the canvas.

## 1. Architecture

### 1.1 Monorepo layout

```
board-ai/
├── packages/
│   ├── shared/     # Types shared by client & server: board objects, socket events, AI DTOs
│   ├── server/     # Express + Socket.IO + Prisma/PostgreSQL API
│   └── client/     # React + TypeScript + Vite + react-konva
├── docker-compose.yml
└── package.json    # npm workspaces root
```

`@collabboard/shared` is the contract between client and server — board object shapes, the Socket.IO event map (`ClientToServerEvents` / `ServerToClientEvents`), and REST DTOs all live there so the two sides can never silently drift apart.

### 1.2 Backend

- **Express** for REST (auth, board CRUD, membership, AI endpoints).
- **Socket.IO** for real-time collaboration: board join/leave, object create/update/delete/batch, cursor movement, and presence — see [`packages/server/src/socket`](packages/server/src/socket).
- **PostgreSQL + Prisma** for persistence. Every board object is normalized into common geometry columns (`x, y, width, height, rotation, zIndex, fill, stroke, ...`) plus a `data` JSON column for type-specific fields (text content, freehand points, image src). This keeps the schema simple while staying flexible per object type.
- **JWT auth**: short-lived access tokens (returned to the client, held in memory) + long-lived opaque refresh tokens (httpOnly cookie, hashed at rest, rotated on every refresh, revocable). Socket connections authenticate with the same access token via the handshake.
- **AI service**: wraps the OpenAI Chat Completions API. Board state is converted into a compact text "digest" (object list + inferred arrow relationships) that's fed to the model as context for summarization, Q&A, suggestions, and diagram generation (via JSON-schema constrained output).

Request flow for a live edit:

```
Client A draws a rectangle
  → optimistic local render + emit `object:create` over the board's Socket.IO room
  → server validates membership/role, persists via Prisma, re-broadcasts `object:created` to the room
  → Client B/C receive the authoritative object and merge it into their local store
```

Conflict handling is intentionally simple: **last-write-wins** per object, keyed by the server's `updatedAt`. This is the right tradeoff for a whiteboard (objects are rarely edited by two people in the same instant, and when they are, "last edit wins" matches user expectation). A full CRDT/OT layer would be the natural next step for cell-level concurrent text editing.

### 1.3 Frontend

- **React + TypeScript + Vite**, no meta-framework — this is a client-heavy real-time app, SSR buys nothing here.
- **react-konva** for the canvas engine (pan/zoom, shapes, freehand drawing, selection/transform handles, live cursor overlay).
- **Zustand** for canvas state (`boardStore`: objects, selection, viewport, undo/redo history, presence, cursors) and auth state (`authStore`). Chosen over Redux/Context for its low ceremony with frequent, high-frequency canvas updates.
- **Socket.IO client** mirrors the server's typed event map so `socket.emit`/`socket.on` are fully typed end-to-end.
- Optimistic updates: every local mutation is applied to the store immediately and reconciled when the server echoes it back — this is what makes dragging/drawing feel instant rather than round-tripping over the network before you see anything move.

### 1.4 Real-time collaboration model

- One Socket.IO room per board (`board:<id>`).
- Presence and live cursors are tracked in an in-memory map on the server (`packages/server/src/socket/presence.ts`), keyed by board — sufficient for a single server instance. **To scale horizontally**, swap this for the [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/) so rooms/broadcasts work across multiple server processes; the handler code wouldn't need to change.
- Cursor position updates are throttled client-side (~25/sec) before being emitted, to keep bandwidth and render cost bounded regardless of mouse polling rate.

### 1.5 AI diagram generation

The AI doesn't draw pixels — it returns structured JSON (`{ nodes: [{id, label}], edges: [{from, to, label}] }`) constrained by an OpenAI JSON-schema response format. The client then:

1. Runs [`dagre`](https://github.com/dagrejs/dagre) to auto-layout the graph (top-to-bottom for flowcharts/process diagrams, left-to-right for mind maps).
2. Converts each node into a real, editable `sticky` board object and each edge into a real `arrow` object, clipped to the node boundary.
3. Persists them exactly like any user-drawn object, via the same `object:batch` socket path — so AI-generated diagrams are immediately live, editable, and synced to every collaborator.

### 1.6 Known simplifications (by design, not oversight)

- **Image storage**: uploaded images are embedded as base64 data URIs directly in the object's JSON payload rather than uploaded to S3/R2/GCS. This works end-to-end but isn't ideal for large images at scale — swap `boardObject.service.ts` + the client's upload handler for real object storage + signed URLs in a production deployment with heavy image use.
- **Invites** require the invitee to already have a CollabBoard account (looked up by email). There's no email-based "invite a stranger to sign up" flow.
- **Undo/redo** is per-client and history-stack based (last-write-wins semantics), not a shared/collaborative undo stack.
- **Freehand paths and arrows** are movable but not resize-handle-editable after creation (only rectangles, ellipses, text, stickies and images expose resize handles) — redrawing is the intended fix for those primitives.

## 2. Getting started

### 2.1 Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or use the provided Docker Compose service)
- An OpenAI API key (for the AI features — everything else works without one)

### 2.2 Install

```bash
npm install
```

This installs all three workspaces (`shared`, `server`, `client`) in one pass.

### 2.3 Configure environment

```bash
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env
```

Edit `packages/server/.env`:
- `DATABASE_URL` — point at your Postgres instance (or leave the default if using `docker compose up postgres`).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — set to long random strings.
- `OPENAI_API_KEY` — required for the AI assistant endpoints; the rest of the app works without it.

### 2.4 Database setup

```bash
# Start just Postgres via Docker, or point DATABASE_URL at your own instance
docker compose up -d postgres

npm run prisma:migrate     # creates the schema
npm run seed --workspace=packages/server   # optional: 3 demo users + a demo board
```

Seeded demo accounts (password `password123`): `jordan@example.com`, `alex@example.com`, `morgan@example.com` — already collaborators on the same "Q3 Product Roadmap" board, so you can log in as each in a separate browser/profile to test three-way real-time collaboration immediately.

### 2.5 Run in development

```bash
npm run dev
```

This runs the API on `http://localhost:4000` and the client on `http://localhost:5173`. Open the client in three different browser profiles (or incognito windows), log in as the three seeded users, join the same board, and edit simultaneously.

### 2.6 Run with Docker

```bash
cp .env.example .env   # fill in JWT secrets + OPENAI_API_KEY
docker compose up --build
```

- Client: http://localhost:8080
- API: http://localhost:4000
- Postgres: localhost:5432

The server container runs `prisma migrate deploy` automatically on startup before booting the API.

### 2.7 Building for production

```bash
npm run build   # builds shared → server → client, in that order
```

## 3. API reference

All REST endpoints are prefixed with `/api`. Authenticated endpoints expect `Authorization: Bearer <accessToken>`; the refresh token travels as an httpOnly cookie scoped to `/api/auth`.

### Auth — `/api/auth`

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/register` | `{ name, email, password }` | Create an account, returns `{ user, accessToken, expiresIn }` and sets the refresh cookie |
| POST | `/login` | `{ email, password }` | Same response shape as register |
| POST | `/refresh` | — (uses cookie) | Rotates the refresh token, returns a new access token |
| POST | `/logout` | — | Revokes the current refresh token |
| GET | `/me` | — | Returns the authenticated user |

### Boards — `/api/boards` (all require auth)

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/` | — | List boards the user is a member of |
| POST | `/` | `{ name, color? }` | Create a board (creator becomes `OWNER`) |
| GET | `/:boardId` | — | Board summary + all objects |
| PATCH | `/:boardId` | `{ name?, isFavorite? }` | Rename (requires `EDITOR`+) / toggle favorite (per-member) |
| DELETE | `/:boardId` | — | Delete a board (requires `OWNER`) |
| POST | `/:boardId/members` | `{ email, role? }` | Invite an existing user as `EDITOR` or `VIEWER` (requires `OWNER`) |
| GET | `/:boardId/objects` | — | List a board's objects |
| POST | `/:boardId/objects` | board object fields | Create an object over REST (fallback path; sockets are the primary path) |

### AI — `/api/ai/boards/:boardId` (all require auth; rate-limited to 10 req/min)

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/summarize` | — | 2–4 sentence summary of the board's current contents |
| POST | `/ask` | `{ question }` | Answer a question grounded in the board's contents |
| POST | `/suggest` | — | 3–6 concrete next-step suggestions |
| POST | `/generate-diagram` | `{ prompt, diagramType? }` | Returns `{ nodes, edges }`; `diagramType` is `flowchart` \| `mindmap` \| `process` |

### Socket.IO events

Connect to the server root namespace with `auth: { token: accessToken }`.

**Client → Server**
- `board:join { boardId }` / `board:leave { boardId }`
- `object:create { boardId, object, clientOpId }`
- `object:update { boardId, id, changes, clientOpId }`
- `object:delete { boardId, id, clientOpId }`
- `object:batch { boardId, objects, clientOpId }` — used for AI-generated diagrams
- `cursor:move { boardId, x, y }`

**Server → Client**
- `board:state { objects, members }` — sent once right after `board:join`
- `object:created` / `object:updated` / `object:deleted` / `object:batch:created`
- `presence:update { users }`
- `cursor:update { userId, name, color, x, y }` / `cursor:remove { userId }`
- `server:error { message }`

Full type definitions: [`packages/shared/src/socket.ts`](packages/shared/src/socket.ts).

## 4. Database schema

See [`packages/server/prisma/schema.prisma`](packages/server/prisma/schema.prisma). Summary:

- `User` — account + a deterministic color assigned at signup (used for avatars, cursors, sticky defaults).
- `RefreshToken` — hashed, revocable, expiring.
- `Board` — owned by a `User`.
- `BoardMember` — join table with `role` (`OWNER` / `EDITOR` / `VIEWER`) and a per-member `isFavorite` flag.
- `BoardObject` — one row per canvas object; common geometry as columns, type-specific fields in a `data` JSON column.

## 5. Security notes

- Passwords hashed with bcrypt (cost factor 12).
- All input validated with `zod` at the REST boundary; Socket.IO payloads are trusted only after membership/role checks.
- `helmet`, scoped CORS, and per-route rate limiting (auth, AI, and general API tiers) are applied server-wide.
- The OpenAI API key never leaves the server — the client only ever calls `/api/ai/*`.
- JWT access tokens are short-lived (15 min default); refresh tokens are httpOnly, rotated on use, and revocable server-side.

## 6. Testing the three-user collaboration scenario

1. `npm run seed --workspace=packages/server` to create the three demo accounts on the same board.
2. Open three browser profiles (or one regular + two incognito windows), log in as `jordan@`, `alex@`, and `morgan@example.com` (password `password123`).
3. Open the "Q3 Product Roadmap" board in all three.
4. Draw/drag/type in one window and confirm it appears in the other two within milliseconds, along with each user's live cursor and name label.
5. In the AI Assistant panel, try "Generate on canvas" with a prompt like *"Flowchart for a customer onboarding process"* — the generated diagram should appear on all three boards simultaneously.
6. Use the Export menu to download the board as PNG and PDF.
