# TaskFlow: MERN Kanban (Trello-style)

## Run
**Backend** (`backend/`): copy `.env.example` to `.env`, fill secrets, then `npm install && npm run dev` (port 5000).
**Frontend** (`kanban-board/`): optionally copy `.env.example` to `.env`, then `npm install && npm run dev` (port 5173).

## Requirements covered
| Requirement | Where |
|---|---|
| MERN integration | React 19 + Vite, Express 5, Mongoose (User, Board, List, Card) |
| Complex auth | bcrypt, JWT access (15m) + rotating refresh (httpOnly cookie, reuse detection), roles owner/admin/member, protected routes, rate limit |
| Real-time sync | Socket.io: JWT handshake, per-board rooms, card/list/board/member events |
| Third-party API | Google Sign-In (set GOOGLE_CLIENT_ID in backend .env and VITE_GOOGLE_CLIENT_ID in frontend .env; add http://localhost:5173 as an authorized JS origin) |
| dnd-kit drag & drop | Cards move within/between lists, lists reorder; order persisted via fractional `position` |
| Trello features | Boards, lists, cards, labels, due dates, assignees, member invites |

## Test real-time
Open two browsers (one incognito), register two users, invite user 2 to a board, drag a card in one and watch the other update.
