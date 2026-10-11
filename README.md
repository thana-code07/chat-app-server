# B-Chat server

HTTP API and Socket.io server for [B-Chat](../client/README.md). Accounts, conversations, and messages live in MongoDB. Passwords are hashed with bcrypt. A session is a JWT sent as `Authorization: Bearer <token>`.

## Setup

```bash
copy .env.example .env
npm install
npm run dev
```

The Flutter client expects the API at `http://localhost:8000`, so set `PORT=8000`.

| Variable          | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `PORT`            | Listen port. Defaults to 3000 when unset.                                 |
| `MONGO_URL`       | MongoDB connection string.                                                |
| `MONGO_DB`        | Database name. Defaults to `chatapp`.                                     |
| `JWT_SECRET`      | Signing secret. Required, at least 32 characters.                         |
| `ALLOWED_ORIGINS` | Comma-separated browser origins. Required. No path and no trailing slash. |

On startup the server creates two demo users and one starter message between them. If `alex` or `sam` already exist, their passwords are reset to the ones published on the welcome screen (`demo-alex` and `demo-sam`), so those credentials stay true.

## Scripts

```bash
npm run dev   # restart on file changes
npm start     # run once
npm test
```

## HTTP

Authenticated routes need `Authorization: Bearer <token>`.

| Method   | Path                                       | Purpose                             |
| -------- | ------------------------------------------ | ----------------------------------- |
| `POST`   | `/api/auth/register`                       | Create an account and a session.    |
| `POST`   | `/api/auth/login`                          | Sign in with username and password. |
| `POST`   | `/api/auth/logout`                         | Revoke the current session.         |
| `GET`    | `/api/auth/me`                             | Current user.                       |
| `DELETE` | `/api/auth/account`                        | Delete the account and its chats.   |
| `PATCH`  | `/api/auth/last-seen`                      | Update last seen.                   |
| `GET`    | `/api/users/search?q=`                     | Find users by username prefix.      |
| `GET`    | `/api/conversations`                       | Inbox.                              |
| `GET`    | `/api/conversations/with/:userId`          | Open a direct chat.                 |
| `GET`    | `/api/conversations/with/:userId/messages` | Message history.                    |
| `POST`   | `/api/messages`                            | Send a message.                     |
| `PATCH`  | `/api/messages/:messageId`                 | Update delivery status.             |

Register body: `{ "username", "email", "password" }`. Login body: `{ "username", "password" }`.

## Realtime

Socket.io uses the same host and the same allowed origins. Connect with `auth: { token }`. The client listens for new messages, status changes, and presence, and sends `message:send`, `message:status`, `message:read`, and `presence:watch`.

## Deploy

Set the variables above on the host. `ALLOWED_ORIGINS` must be the exact web app origin. Build the Flutter client with `--dart-define=API_BASE_URL=` set to this server's public `https://` URL. The current demo client is [https://b-chat-psi.vercel.app](https://b-chat-psi.vercel.app).
