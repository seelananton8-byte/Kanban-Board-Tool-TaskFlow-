# TaskFlow: Real-time Kanban Workspace (MERN)

A Trello-style collaborative Kanban board built with the MERN stack. Boards, lists and cards with drag and drop (dnd-kit), live multi-user sync (Socket.io), secure JWT authentication, Google sign-in and email notifications (Brevo).

**Live demo:** https://kanban-board-tool-task-flow.vercel.app
(The backend runs on Render's free tier and sleeps after inactivity, so the first request can take up to a minute.)

## Features

- **Boards, lists, cards:** create, rename, delete; labels, due dates, assignees, complete tick
- **Drag and drop (dnd-kit):** move cards within and across lists, reorder lists; the order is saved to the database; long-press touch support on phones
- **Real-time sync:** changes by one member appear instantly for everyone on the board; automatic resync after a reconnect
- **Teams and roles:** invite members by email; owner, admin and member roles (the owner can promote or demote); remove or leave a board; removed users lose access immediately
- **Authentication:** email/password and Google Sign-In; short-lived JWT access tokens and rotating refresh tokens in httpOnly cookies with reuse detection
- **Email notifications (Brevo API):** when you are added to a board or assigned to a card
- **Polished UI:** responsive layout (desktop, tablet, phone), skeleton loaders, toasts and confirm dialogs

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, React Router, dnd-kit, Axios, Socket.io client, lucide-react |
| Backend | Node.js, Express 5, Mongoose (MongoDB), Socket.io, bcryptjs, jsonwebtoken, helmet, express-rate-limit |
| Third-party APIs | Google Identity (OAuth sign-in), Brevo transactional email API |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

## Architecture

```
React SPA --REST (Axios, Bearer access token)--> Express API --> MongoDB
    |                                                |
    +-------- Socket.io (JWT handshake, rooms) -----+--> Brevo email API
```

- Every list and card query is scoped to its board, and every route checks board membership and role.
- Card and list order uses fractional `position` values, so a move updates a single document.
- The server does not echo a change back to the tab that made it (`x-socket-id` header).
- The access token lives in memory only; the refresh token is an httpOnly cookie, stored hashed in the database and rotated on every use. Reusing an old refresh token revokes all sessions.
- In production the frontend proxies `/api` to the backend through Vercel rewrites, so the cookie stays first-party and sessions persist in Safari/iOS.

### Project structure

```
TaskFlow/
  backend/
    models/        User, Board, List, Card
    routes/        auth, boards, lists, cards
    middleware/    auth (JWT), boardAccess (membership and role)
    utils/         tokens, validate, position, mailer, realtime, origins
    tests/         unit tests (node:test)
    socket.js      Socket.io setup and board rooms
    server.js      app setup, security middleware
  kanban-board/
    src/
      pages/       AuthPage, BoardsPage, BoardPage
      components/  AppShell, CardModal, Feedback (toasts, dialogs), Skeleton
      context/     AuthContext
      services/    api (Axios + token refresh), socket
      styles/      app.css, auth.css
    vercel.json    API proxy and security headers
```

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `login`, `google`, `refresh`, `logout`; `GET /api/auth/me` |
| Boards | `GET/POST /api/boards`; `GET/PATCH/DELETE /api/boards/:id` |
| Members | `POST /api/boards/:id/members`; `PATCH/DELETE /api/boards/:id/members/:userId` |
| Lists | `POST /api/boards/:id/lists`; `PATCH/DELETE .../lists/:listId`; `PATCH .../lists/:listId/move` |
| Cards | `POST /api/boards/:id/cards`; `PATCH/DELETE .../cards/:cardId`; `PATCH .../cards/:cardId/move` |
| Health | `GET /api/health` |

**Socket events:** `card:created|updated|moved|deleted`, `list:created|updated|moved|deleted`, `board:updated|deleted`, `member:added|updated|removed`. Clients connect with `auth: { token }` and join a board room with `board:join`.

## Run locally

**Backend** (`backend/`)

```bash
cp .env.example .env     # fill in the values below
npm install
npm run dev              # http://localhost:5000
```

**Frontend** (`kanban-board/`)

```bash
cp .env.example .env     # optional
npm install
npm run dev              # http://localhost:5173
```

### Backend environment variables

| Variable | Notes |
|---|---|
| `MONGODB_URI` | Local MongoDB or an Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ characters each, and they must differ |
| `CLIENT_URL` | Frontend origin(s), comma separated |
| `GOOGLE_CLIENT_ID` | Optional, enables Google sign-in |
| `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` | Optional, enable email notifications (`MAIL_FROM` must be a verified Brevo sender) |
| `NODE_ENV` | `production` on the server |

### Frontend environment variables

`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID` (see `kanban-board/.env.example`).

On Vercel, set `VITE_API_URL=/api` and `VITE_SOCKET_URL` to the backend URL. The rewrite in `kanban-board/vercel.json` proxies `/api` to the backend.

## Deployment

| Part | Platform | Settings |
|---|---|---|
| Database | MongoDB Atlas (M0 free) | Database user, network access `0.0.0.0/0`, connection string ending in `/taskflow` |
| Backend | Render web service | Root directory `backend`, build `npm install`, start `npm start`, health check `/api/health` |
| Frontend | Vercel | Root directory `kanban-board`, framework Vite, `VITE_*` variables |

Set `CLIENT_URL` on Render to the Vercel production URL (exact match, no trailing slash) and add the same URL to the Google OAuth client's authorized JavaScript origins. If Brevo's IP restriction is enabled, authorize the server's outbound IP in Brevo.

## Try real-time sync

Open two browsers (one incognito), register two users, invite the second user to a board, then drag a card in one window and watch the other update.

## Tests

```bash
cd backend
npm test
```

Unit tests cover the card/list ordering logic and the input validators (`node --test`, no extra dependencies).

## Security

- Passwords hashed with bcrypt; access token kept in memory only; refresh token in an httpOnly cookie, stored hashed, rotated on every use
- Every board, list and card query is scoped to the board and checks membership and role
- Input validation on all write routes; request body limited to 100 KB
- Rate limiting: global per IP, stricter per IP on auth routes, and per account on login attempts
- Helmet and strict CORS on the API; security headers on the frontend
- No secrets in the repository (`.env` is git-ignored)
- `npm audit --omit=dev` reports 0 vulnerabilities in both projects

## Known limitations

No email verification or password reset; a board loads all of its cards at once (no pagination); fractional positions are not rebalanced after a very large number of moves; the free Render tier sleeps after inactivity, so the first request can take up to a minute.