<<<<<<< HEAD
# Neighborhood Community Board

A full-stack neighborhood board app with **role-based authentication and authorization**. Users can register, log in, create posts, comment, and react. Admins can manage users and delete any post.

- **Backend:** Node.js, Express, TypeScript, SQLite (via sql.js)
- **Frontend:** Angular 21 (standalone components, reactive forms, route guards)
- **Auth:** Session tokens, roles `admin` and `user`

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Project structure](#project-structure)
3. [Installation](#installation)
4. [How to start the app](#how-to-start-the-app)
5. [How to test](#how-to-test)
6. [Demo accounts and flows](#demo-accounts-and-flows)
7. [API overview](#api-overview)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you start, ensure you have:

| Requirement | Version / notes |
|-------------|------------------|
| **Node.js** | **18 or higher** (check with `node -v`) |
| **npm**     | Comes with Node (check with `npm -v`) |
| **Angular CLI** | Installed globally **or** via `npx` (see below) |

Optional for API testing:

- **Postman**, **Insomnia**, or **curl** for calling the API directly.

---

## Project structure

```
wad/
├── README.md                 ← You are here
├── package.json              ← Root scripts (install:all, dev, build, start)
├── server/                   ← Backend (Express + SQLite)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts          ← App entry, routes
│   │   ├── auth.ts           ← Session, requireAuth, requireRole
│   │   ├── db.ts             ← SQLite init, schema
│   │   ├── types.ts
│   │   └── routes/
│   │       ├── auth.ts       ← /api/authentication (login, register, logout)
│   │       ├── users.ts      ← /api/users (me, admin: list/update/delete users)
│   │       ├── posts.ts      ← /api/posts (CRUD, comments, reactions)
│   │       └── categories.ts ← /api/categories
│   └── data.db               ← Created at first run (SQLite file)
├── client/
│   └── frontend/             ← Angular app
│       ├── package.json
│       ├── angular.json
│       ├── proxy.conf.json   ← Proxies /api to http://localhost:3000
│       └── src/
│           └── app/
│               ├── app.ts, app.config.ts, app.routes.ts
│               ├── services/auth.service.ts
│               ├── guards/auth.guard.ts, admin.guard.ts
│               └── components/
│                   ├── login/, register/, home/
│                   ├── user-dashboard/   ← Feed, create post, profile, comments, reactions
│                   └── admin-dashboard/  ← Users list, posts list, delete, edit user
├── public/                   ← Static fallback (minimal HTML)
└── docs/
    └── API.md                ← API description
```

---

## Installation

Install **all** dependencies (root + server). The frontend has its own install step.

### 1. Install root and server dependencies

From the **project root** (`wad/`):

```bash
npm run install:all
```

This runs:

- `npm install` (root)
- `cd server && npm install` (server)

### 2. Install frontend dependencies

```bash
cd client/frontend
npm install
cd ../..
```

You can use `npx ng` without installing Angular CLI globally. If you prefer a global CLI:

```bash
npm install -g @angular/cli@21
```

---

## How to start the app

You need **two processes**: the backend (API) and the frontend (Angular dev server). The frontend proxies `/api` to the backend.

### Step 1: Start the backend

From the **project root** (`wad/`):

```bash
npm run dev
```

- Runs the server with `ts-node-dev` (auto-restart on file changes).
- Server listens on **http://localhost:3000**.
- On first run, the database file `server/data.db` is created and seeded with categories and a default admin user.
- You should see: `Server running at http://localhost:3000`.

Leave this terminal open.

### Step 2: Start the frontend

Open a **second terminal**. From the **project root**:

```bash
cd client/frontend
npm start
```

Or, with proxy explicitly:

```bash
cd client/frontend
npx ng serve --proxy-config proxy.conf.json
```

- Angular dev server runs at **http://localhost:4200**.
- Requests to `http://localhost:4200/api/*` are proxied to `http://localhost:3000/api/*`.
- After compilation, open a browser to **http://localhost:4200**.

### Summary

| What        | URL                  | When to use                    |
|------------|----------------------|--------------------------------|
| **Frontend** | http://localhost:4200 | Normal use (login, register, dashboards) |
| **Backend API** | http://localhost:3000/api | Direct API testing (Postman, curl) |

---

## How to test

### 1. Manual testing in the browser (recommended)

1. **Start backend and frontend** as in [How to start the app](#how-to-start-the-app).
2. Open **http://localhost:4200**.
3. You should be redirected to **/login** (or see the login page).
4. **Register a new user**
   - Click “Create Account” or go to http://localhost:4200/register.
   - Fill: Display Name, Email, Password (min 6 characters).
   - Submit → success message → redirect to login.
5. **Log in as the new user**
   - Email + password → Sign In.
   - You should land on **User Dashboard** (feed, “New Post”, “Profile”, “Logout”).
6. **User flows**
   - **Create post:** “+ New Post” → title, description, category, zone → Create Post.
   - **View post:** Click a post card → see details, comments, reaction buttons.
   - **Comment:** In post detail, type in “Write a comment…” → Post Comment.
   - **React:** Click e.g. “👍 Helpful” (or other reaction) on a post.
   - **Profile:** Profile → edit Display Name, Zone, optionally password → Update Profile.
7. **Log out** → you should be back at the login page.
8. **Log in as admin**
   - Email: **admin@example.com**, Password: **admin123**.
   - You should land on **Admin Dashboard** (sidebar: “All Users”, “All Posts”).
9. **Admin flows**
   - **Users:** “All Users” → list of users → Edit (change name/role/status) or Delete.
   - **Posts:** “All Posts” → list of posts → “Delete Post” on any post.
10. **Guards**
    - Logged out: visiting http://localhost:4200/home or /user-dashboard or /admin should redirect to login.
    - Logged in as **user**: visiting http://localhost:4200/admin should redirect to /home (then to user-dashboard).
    - Logged in as **admin**: /admin should load; /user-dashboard also works.

### 2. Testing the API with curl

Backend must be running at http://localhost:3000.

**Register**

```bash
curl -X POST http://localhost:3000/api/authentication/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"test123\",\"displayName\":\"Test User\"}"
```

Expected: `201` with a message like `"Registration successful"`.

**Login**

```bash
curl -X POST http://localhost:3000/api/authentication/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"
```

Expected: `200` with JSON containing `token` and `user` (including `roleList`, `isAdmin`). Copy the `token` value.

**Get current user (authenticated)**

Replace `YOUR_TOKEN` with the token from login:

```bash
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: `200` with your user profile and `isAdmin`.

**Get posts (optional auth)**

```bash
curl -X GET "http://localhost:3000/api/posts?page=0&size=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: `200` with `{ "content": [...], "total", "page", "size" }`.

**Create a post (requires auth)**

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test Post\",\"description\":\"Hello world\",\"categoryId\":1,\"zone\":\"Downtown\"}"
```

Expected: `201` with the created post.

**Admin: get all users (admin only)**

Use the **admin** token (e.g. from admin@example.com):

```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Expected: `200` with array of users. If you use a normal user token: `403 Forbidden`.

### 3. Testing with Postman (or Insomnia)

1. **Environment**
   - Base URL: `http://localhost:3000` (for direct API testing).
   - Or use `http://localhost:4200` if you want the same origin as the app (proxy forwards `/api` to 3000).

2. **Register**
   - Method: `POST`
   - URL: `{{baseUrl}}/api/authentication/register`
   - Body: raw JSON  
     `{ "email": "user@example.com", "password": "pass123", "displayName": "Jane Doe" }`

3. **Login**
   - Method: `POST`
   - URL: `{{baseUrl}}/api/authentication/login`
   - Body: raw JSON  
     `{ "email": "admin@example.com", "password": "admin123" }`
   - Save the `token` from the response.

4. **Authenticated requests**
   - Add header:  
     `Authorization` = `Bearer <paste token here>`
   - Then try: GET `/api/users/me`, GET `/api/posts`, POST `/api/posts`, etc.

5. **Admin-only**
   - Use the admin token and call GET `/api/users` (list all users), DELETE `/api/posts/:postId`, etc.

### 4. Frontend unit tests (if you add or run them)

From the frontend folder:

```bash
cd client/frontend
npm test
```

Runs the project’s test runner (e.g. Vitest) for unit tests. The project may have minimal or no tests by default; the command is for when you add tests.

---

## Demo accounts and flows

| Role  | Email               | Password   | After login        |
|-------|---------------------|------------|--------------------|
| Admin | admin@example.com   | admin123   | Admin Dashboard    |
| User  | (any registered)     | (your pwd) | User Dashboard     |

- **Register** always creates a **user** (role `user`).
- **Admin** is the seeded user with role `administrator` (mapped to `admin` in the UI).
- Login response includes `user.roleList` and `user.isAdmin`; the app uses these for redirects and guards.

---

## API overview

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST   | /api/authentication/register | No  | -    | Register (email, password, displayName) |
| POST   | /api/authentication/login    | No  | -    | Login → token + user (roleList, isAdmin) |
| POST   | /api/authentication/logout  | Yes | -    | Invalidate session |
| GET    | /api/users/me               | Yes | -    | Current user profile |
| PUT    | /api/users/me               | Yes | -    | Update own profile (displayName, password, zone) |
| GET    | /api/users                  | Yes | Admin| List all users |
| PUT    | /api/users/:userId          | Yes | Admin| Update user |
| DELETE | /api/users/:userId          | Yes | Admin| Soft-delete user |
| GET    | /api/categories             | No* | -    | List categories |
| GET    | /api/posts                  | No* | -    | List posts (paginated, filter by categoryId, zone) |
| GET    | /api/posts/:postId          | No* | -    | Post detail + comments + reactions |
| POST   | /api/posts                  | Yes | User | Create post |
| PUT    | /api/posts/:postId          | Yes | Owner/Admin | Update post |
| DELETE | /api/posts/:postId          | Yes | Owner/Admin | Archive post |
| POST   | /api/posts/:postId/comments | Yes | User | Add comment |
| POST   | /api/posts/:postId/reactions | Yes | User | Set reaction (helpful, interested, congratulations, sold) |

\*Auth optional for read; if present, response can include `myReactions` and user-specific data.

Full details: see **docs/API.md**.

---

## Troubleshooting

### “Cannot GET /” or blank page at http://localhost:3000

- You are hitting the **backend** only. For the Angular UI, use **http://localhost:4200** (frontend). The backend serves a minimal static page at `/`; the full app is the Angular build.

### Frontend shows “Failed to fetch” or network errors for /api

- Backend must be running on **port 3000**.
- Frontend must be started with the proxy: from `client/frontend`, run `npm start` or `ng serve --proxy-config proxy.conf.json` so that `/api` is proxied to `http://localhost:3000`.

### 401 Unauthorized on protected routes

- Login again and ensure the app stores the token (e.g. in `localStorage`).
- Request must send header: `Authorization: Bearer <token>` (no extra quotes or spaces in the token).

### 403 Forbidden on /api/users or admin actions

- The token must belong to a user with role **administrator** (admin). Use `admin@example.com` / `admin123` or an account you promoted to admin in the DB.

### Sign in or register is very slow

- Password hashing uses bcrypt; the app uses a lower cost (8) for faster login/register. If you created the database **before** this change, the seeded admin account may still use the old cost and feel slow. To get faster admin login: stop the server, delete `server/data.db`, start again so the admin user is recreated with the faster hash. New registrations are always fast.

### Database or seed issues

- The SQLite file is created at `server/data.db` on first run. To reset: stop the server, delete `server/data.db`, start again; the schema and seed (categories + admin user) will be recreated.

### Port already in use

- Change backend port: e.g. `PORT=3001 npm run dev` (then in `proxy.conf.json` point `target` to `http://localhost:3001` and restart Angular).
- Change frontend port: `ng serve --port 4201`.

### Angular or Node version issues

- Use **Node 18+**.
- Use the project’s Angular version (21.x) and run `npm install` in `client/frontend` so dependencies match.

---

## Quick reference: commands

```bash
# From project root (wad/)

# Install everything
npm run install:all
cd client/frontend && npm install && cd ../..

# Start backend (terminal 1)
npm run dev

# Start frontend (terminal 2)
cd client/frontend && npm start

# Open in browser
# http://localhost:4200  → Login / Register / User Dashboard / Admin Dashboard
```

For more API detail, see **docs/API.md**.
=======
# Neighborhood-Board-Project
>>>>>>> 13d10d611bb4a24be81cfbfc7b5e11d9cdb2b022
