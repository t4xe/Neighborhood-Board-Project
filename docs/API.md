# Neighborhood Community Board — API (backend only)

Backend is implemented; frontend is the teammate’s task. This document describes the API.

- **Base URL:** `/api`
- **Auth:** Send `Authorization: Bearer <token>` after login. Token is returned by `POST /api/authentication/login`.

## Authentication

- **POST /api/authentication/register**  
  Body: `{ "email": string, "password": string, "displayName": string }`  
  Returns: `201` with `{ "message": "Registration successful", "user_id": number }`. Creates a user with role `user` (stored as `regular`). Password is hashed before storing.

- **POST /api/authentication/login**  
  Body: `{ "email": string, "password": string }`  
  Returns: `{ "token": string, "user": { user_id, email, display_name, roles, types, zone, status, roleList, typeList, isAdmin } }`  
  Demo: `admin@example.com` / `admin123`

- **POST /api/authentication/logout**  
  Requires auth. Clears session.

## Users

- **GET /api/users/me**  
  Requires auth. Returns current user profile, roleList, typeList, isAdmin.

- **PUT /api/users/me**  
  Requires auth. Body: `{ displayName?, password?, zone? }`. Update own profile (password min 6 chars).

- **GET /api/users**  
  Requires auth, **admin** only. Returns list of all users (user_id, email, display_name, roles, status, isAdmin, etc.).

- **PUT /api/users/:userId**  
  Requires auth, **admin** only. Body: `{ displayName?, roles?, status?, zone? }`. Update any user.

- **DELETE /api/users/:userId**  
  Requires auth, **admin** only. Soft-deletes user (sets status to `deleted`).

## Categories

- **GET /api/categories**  
  Returns list of categories (category_id, name, description, rules).

## Posts

- **GET /api/posts**  
  Query: `categoryId`, `zone`, `page`, `size`, `sort` (e.g. `created_at,desc`).  
  Returns: `{ content: Post[], total, page, size }`. Each post includes author_name, category_name, myReactions (if authenticated).

- **GET /api/posts/:postId**  
  Returns post with comments and reactions. myReactions present if authenticated.

- **POST /api/posts**  
  Requires auth. Body: `{ title, description, categoryId, zone, price? }`.

- **PUT /api/posts/:postId**  
  Requires auth. Owner or management. Body: `{ title?, description?, price?, zone?, status? }`. Owner can only edit within 15 minutes.

- **DELETE /api/posts/:postId**  
  Requires auth. Owner or management. Soft-delete (archives post).

- **POST /api/posts/:postId/comments**  
  Requires auth. Body: `{ body: string }`.

- **POST /api/posts/:postId/reactions**  
  Requires auth. Body: `{ type: "helpful" | "interested" | "congratulations" | "sold" }`.

## Data model (high-level)

- **User:** user_id, email, password_hash, display_name, roles, types, zone, status, created_at. Roles: administrator, management, regular, visitor.
- **Category:** category_id, name, description, rules.
- **Post:** post_id, author_id, category_id, title, description, price, zone, geo_point, status (active|resolved|archived), expires_at, created_at, updated_at.
- **Comment:** comment_id, post_id, author_id, body, created_at, edited_at.
- **Reaction:** reaction_id, post_id, author_id, type, created_at.

Frontend developer should implement: login, feed with filters (category, zone) and pagination, post detail (comments, reactions), create/edit post, role-based UI, one chart (e.g. posts per category). Use Angular; backend serves the built app from the same origin in production.
