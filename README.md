# TaskFlow: Real-time Kanban Workspace (MERN)

A Trello-style collaborative Kanban board built with the MERN stack: boards, lists and cards with drag and drop (dnd-kit), live multi-user sync (Socket.io), secure JWT authentication, Google sign-in and email notifications (Brevo).

**Live demo:** _add your Vercel link here_

## Features
- **Boards, lists, cards:** create, rename, delete; labels, due dates, assignees, complete tick
- **Drag and drop (dnd-kit):** move cards within and across lists, reorder lists; order is saved to the database; touch (long-press) support on phones
- **Real-time sync:** changes by one member appear instantly for everyone on the board; automatic resync after reconnect
- **Teams and roles:** invite members by email; owner, admin and member roles; remove/leave board; removed users lose access immediately
- **Authentication:** email/password and Google Sign-In, JWT access tokens (15 min), rotating refresh tokens in httpOnly cookies with reuse detection
- **Email notifications (Brevo API):** when you are added to a board or assigned to a card
- **Polished UI:** responsive layout, skeleton loaders, toasts and confirm dialogs

## Tech stack
| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, React Router, dnd-kit, Axios, Socket.io client, lucide-react |
| Backend | Node.js, Express 5, Mongoose (MongoDB), Socket.io, bcryptjs, jsonwebtoken, helmet, express-rate-limit |
| Third-party APIs | Google Identity (OAuth sign-in), Brevo transactional email API |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

## How it fits together
```
React SPA  --REST (Axios, Bearer access token)-->  Express API  -->  MongoDB
    |                                                   |
    +------- Socket.io (JWT handshake, board rooms) ----+--> Brevo email API
```
- Every list/card query is scoped to the board, and every route checks board membership and role.
- Card/list order uses fractional `position` values, so a move updates a single document.
- The server skips echoing a change back to the tab that made it (`x-socket-id` header).

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
| `MONGODB_URI` | Local MongoDB or Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ characters each, must differ |
| `CLIENT_URL` | Frontend origin(s), comma separated |
| `GOOGLE_CLIENT_ID` | Optional, enables Google sign-in |
| `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` | Optional, enable email notifications (`MAIL_FROM` must be a verified Brevo sender) |
| `NODE_ENV` | `production` on the server |

### Frontend environment variables
`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID` (see `kanban-board/.env.example`).

## Try real-time sync
Open two browsers (one incognito), register two users, invite the second user to a board, then drag a card in one window and watch the other update.

## Known limitations
No automated tests yet; no email verification or password reset; fractional positions are not rebalanced after very many moves; refresh-token cookie is cross-site when frontend and backend use different domains.