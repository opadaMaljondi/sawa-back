# Sawa API - Postman Collection

## Import

1. Open Postman → **Import** → drag and drop or select:
   - `Sawa-API.postman_collection.json`
   - `Sawa-Local.postman_environment.json` (optional)

2. Select the **Sawa - Local** environment from the top-right dropdown.

## Variables

| Variable   | Description                    | Example                    |
|-----------|--------------------------------|----------------------------|
| `base_url` | API base URL                   | `http://localhost:8000/api` |
| `token`    | Bearer token (set after login) | Paste from login response  |

## Usage

1. **Login** (e.g. **Auth (Public) → Login (General)** or **Student - Login** / **Instructor - Login**).
2. Copy the `token` from the response.
3. In the environment, set **token** = the copied value (or use **Authorization** tab and type `Bearer <token>`).
4. All requests under **Student**, **Instructor**, or **Admin** will use this token.

Replace path IDs (`1`, `courseId`, `lessonId`, etc.) with real IDs from your database when testing.
