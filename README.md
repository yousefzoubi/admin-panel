# Admin Panel

A full-stack admin panel: a REST API with real-time chat (Node.js, Express, Prisma, PostgreSQL, Socket.IO) and a lightweight vanilla-JS frontend with Arabic/English and dark mode support.

## Features

- **Authentication**: register / login with JWT access tokens (15 min) and refresh tokens stored in the database, logout, and OTP verification at login (sent by email via Nodemailer).
- **Role-based access control**: four roles (`USER`, `EDITOR`, `MODERATOR`, `ADMIN`) enforced by middleware (`requirePermission`).
- **Users**: list, view, update, soft delete and restore (admin).
- **Articles**: CRUD with publish / unpublish; moderators and admins can manage any article.
- **Audit log**: actions (`CREATE`, `READ`, `UPDATE`, `DELETE`, `VIEW`, `RESTORE`) are recorded and readable by admins.
- **Dashboard stats** endpoint.
- **Real-time chat**: conversations, messages, and read receipts over Socket.IO (authenticated sockets, one room per conversation).
- **Request validation** and a centralized error handler.

## Tech stack

| Layer | Tools |
|---|---|
| Runtime / API | Node.js, Express 5 |
| Database | PostgreSQL, Prisma 7 (with `@prisma/adapter-pg`) |
| Auth | JWT (`jsonwebtoken`), `bcrypt` |
| Real-time | Socket.IO |
| Email | Nodemailer |
| Frontend | Vanilla JS, served by a small Node server (`admin-panel-frontend/`) |

## Project structure

```
src/
  index.js          # Express + Socket.IO bootstrap
  routes.js         # all HTTP routes
  controllers/      # request handlers: auth, users, articles, chat, admin
  middlewares/      # auth, permissions, validation, error handler, socket auth
  services/         # auth, OTP, email, audit log
  realtime.js       # Socket.IO helpers (rooms)
prisma/
  schema.prisma     # data model
  migrations/
admin-panel-frontend/   # UI (see its own README)
```

## Getting started

**Prerequisites:** Node.js 20+, PostgreSQL.

```bash
# 1. install dependencies
npm install

# 2. configure environment
cp .env.example .env      # then fill in your own values

# 3. generate the Prisma client and apply migrations
npm run prisma:generate
npm run prisma:migrate

# 4. start the API (http://localhost:9999)
npm run dev
```

Then start the frontend in a second terminal:

```bash
cd admin-panel-frontend
npm run dev               # http://localhost:5173
```

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `PORT` | API port (default `9999`) |
| `NODE_ENV` | `development` / `production` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP account used to send OTP emails |
| `OTP_BYPASS_EMAILS` | Comma-separated emails that skip OTP (development only) |

## API overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/register`, `/login`, `/login/verify-otp`, `/refresh`, `/logout` | Authentication |
| GET | `/users`, `/users/:id` | List / view users |
| PUT / DELETE | `/users/:id` | Update / soft-delete a user |
| POST | `/users/:id/restore` | Restore a deleted user |
| GET / POST | `/articles` | List / create articles |
| GET / PUT / DELETE | `/articles/:id` | Read / update / delete an article |
| PATCH | `/articles/:id/publish`, `/articles/:id/unpublish` | Change publish state |
| GET | `/users/:id/articles` | Articles of one user |
| GET | `/dashboard/stats` | Dashboard numbers |
| GET | `/audit-logs` | Audit log (admin) |
| GET / POST | `/conversations` | List / create conversations |
| DELETE | `/conversations/:id` | Delete a conversation |
| GET / POST | `/conversations/:id/messages` | Read / send messages |
| PATCH | `/conversations/:id/read` | Mark messages as read |

**Socket.IO events:** `join_conversation`, `send_message`, `mark_messages_read`.

## Known limitations

- No automated tests yet (`socket-test.mjs` / `socket-test-user2.mjs` are manual Socket.IO scripts).
- No rate limiting on the auth endpoints.

## Author

Yousef Alzoubi: yoyo.alzoubi@gmail.com
