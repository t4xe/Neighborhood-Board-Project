# Testing the API with Postman

**Base URL:** `http://localhost:3000`  
Make sure the server is running (`npm start` or `npm run dev`).

---

## 1. Login (get token)

Use this first. Copy the `token` from the response for all protected requests.

| Field | Value |
|-------|--------|
| **Method** | `POST` |
| **URL** | `http://localhost:3000/api/authentication/login` |
| **Headers** | `Content-Type: application/json` |
| **Body** | raw → JSON |

**Body (raw JSON):**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Expected:** Status `200 OK`  
**Response:** JSON with `token` and `user`. Copy the `token` value.

**Wrong credentials:** Status `401`, body: `{ "error": "Unauthorized", "message": "Incorrect email or password" }`

---

## 2. Use the token for protected requests

For any request that needs auth:

- **Headers** tab → Add header:
  - **Key:** `Authorization`
  - **Value:** `Bearer <paste your token here>`

Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your token will be different)

---

## 3. Get current user (protected)

| Field | Value |
|-------|--------|
| **Method** | `GET` |
| **URL** | `http://localhost:3000/api/users/me` |
| **Headers** | `Authorization: Bearer <your token>` |

**Expected:** Status `200 OK`, JSON with your user (user_id, email, display_name, roles, roleList, etc.)

**Without token:** Status `401`

---

## 4. List categories (no auth)

| Field | Value |
|-------|--------|
| **Method** | `GET` |
| **URL** | `http://localhost:3000/api/categories` |

**Expected:** Status `200 OK`, JSON array of categories (News, Lost and Found, For Sale, Services, Events). Each has `category_id`, `name`, `description`, `rules`.

---

## 5. List posts (no auth; optional filters)

| Field | Value |
|-------|--------|
| **Method** | `GET` |
| **URL** | `http://localhost:3000/api/posts` |

**Optional query params** (Params tab in Postman):

| Param | Example | Description |
|-------|---------|-------------|
| `categoryId` | `1` | Filter by category |
| `zone` | `Downtown` | Filter by zone |
| `page` | `0` | Page number (default 0) |
| `size` | `20` | Page size (default 20) |
| `sort` | `created_at,desc` | Sort (e.g. `created_at,asc`, `title,desc`) |

Example URL with params:  
`http://localhost:3000/api/posts?page=0&size=10&sort=created_at,desc`

**Expected:** Status `200 OK`, JSON: `{ "content": [...], "total": number, "page": number, "size": number }`. Initially `content` may be empty.

---

## 6. Create a post (protected)

| Field | Value |
|-------|--------|
| **Method** | `POST` |
| **URL** | `http://localhost:3000/api/posts` |
| **Headers** | `Content-Type: application/json`, `Authorization: Bearer <token>` |
| **Body** | raw → JSON |

**Body (raw JSON):**
```json
{
  "title": "Test post",
  "description": "This is a test post from Postman.",
  "categoryId": 1,
  "zone": "Downtown",
  "price": 10.50
}
```

`price` is optional. `categoryId` must match an existing category (1–5 for the seed data).

**Expected:** Status `201 Created`, JSON with the new post (including `post_id`).  
**Use the `post_id`** for the next steps (get, update, delete, comment, react).

---

## 7. Get one post (no auth)

| Field | Value |
|-------|--------|
| **Method** | `GET` |
| **URL** | `http://localhost:3000/api/posts/1` |

Replace `1` with a real `post_id` (e.g. from the create response).

**Expected:** Status `200 OK`, JSON with post details plus `comments` and `reactions` arrays, and `myReactions` if you’re logged in.

**Not found:** Status `404`

---

## 8. Update a post (protected; owner or management)

| Field | Value |
|-------|--------|
| **Method** | `PUT` |
| **URL** | `http://localhost:3000/api/posts/1` |
| **Headers** | `Content-Type: application/json`, `Authorization: Bearer <token>` |
| **Body** | raw → JSON |

**Body (any subset):**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "price": 15,
  "zone": "Center",
  "status": "active"
}
```

**Expected:** Status `200 OK`, JSON with updated post.  
**Owner** can only edit within 15 minutes; after that you get `403` unless you’re management/administrator.

---

## 9. Add a comment (protected)

| Field | Value |
|-------|--------|
| **Method** | `POST` |
| **URL** | `http://localhost:3000/api/posts/1/comments` |
| **Headers** | `Content-Type: application/json`, `Authorization: Bearer <token>` |
| **Body** | raw → JSON |

**Body:**
```json
{
  "body": "This is a test comment from Postman."
}
```

**Expected:** Status `201 Created`, JSON with the new comment.

---

## 10. Add or change reaction (protected)

| Field | Value |
|-------|--------|
| **Method** | `POST` |
| **URL** | `http://localhost:3000/api/posts/1/reactions` |
| **Headers** | `Content-Type: application/json`, `Authorization: Bearer <token>` |
| **Body** | raw → JSON |

**Body:**
```json
{
  "type": "helpful"
}
```

Allowed `type`: `"helpful"`, `"interested"`, `"congratulations"`, `"sold"`.

**Expected:** Status `200 OK`, JSON with the reaction.

---

## 11. Delete (archive) a post (protected)

| Field | Value |
|-------|--------|
| **Method** | `DELETE` |
| **URL** | `http://localhost:3000/api/posts/1` |
| **Headers** | `Authorization: Bearer <token>` |

**Expected:** Status `204 No Content`. Post is archived (soft delete).

---

## 12. Logout (protected)

| Field | Value |
|-------|--------|
| **Method** | `POST` |
| **URL** | `http://localhost:3000/api/authentication/logout` |
| **Headers** | `Authorization: Bearer <token>` |

**Expected:** Status `204 No Content`. Token is invalidated.

---

## Suggested test order

1. **Login** → copy token.  
2. **GET /api/categories** → check categories.  
3. **GET /api/posts** → check empty or existing posts.  
4. **GET /api/users/me** → check profile (with token).  
5. **POST /api/posts** → create post, note `post_id`.  
6. **GET /api/posts/{post_id}** → check post + comments/reactions.  
7. **POST /api/posts/{post_id}/comments** → add comment.  
8. **POST /api/posts/{post_id}/reactions** → add reaction.  
9. **GET /api/posts** → see your post in the list.  
10. **PUT /api/posts/{post_id}** → update (within 15 min as owner).  
11. **DELETE /api/posts/{post_id}** → archive post.  
12. **POST /api/authentication/logout** → logout.

---

## Postman environment (optional)

1. Create an **Environment** (e.g. “NCB Local”).  
2. Add variables:
   - `baseUrl` = `http://localhost:3000`
   - `token` = (leave empty; set after login)
3. Use `{{baseUrl}}/api/...` in URLs and `Bearer {{token}}` in Authorization.  
4. After login, set `token` in the environment to the value from the response (or use a short script in the Login request’s Tests tab: `pm.environment.set("token", pm.response.json().token);`).

---

## Quick sanity check

- **GET** `http://localhost:3000/api/categories` → 200, array of 5 categories.  
- **POST** `http://localhost:3000/api/authentication/login` with body above → 200, `token` in response.  
- **GET** `http://localhost:3000/api/users/me` with `Authorization: Bearer <token>` → 200, your user.

If these three work, the API is running and auth is correct.
