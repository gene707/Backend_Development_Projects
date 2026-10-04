# JWT Authentication Service (Token-Based Login & RBAC)

A secure, production-grade token-based authentication and authorization microservice built with Node.js, Express, JSON Web Tokens (JWT), and bcrypt password hashing.

---

## Features

- **Secure Password Hashing**: Passwords salted and hashed with `bcryptjs` (never stored in plaintext).
- **Token-Based Authentication**: Issues signed HMAC-SHA256 JWT tokens with configurable expiration.
- **Granular Token Expiry Handling**: Distinct, informative error responses for expired vs. invalid vs. missing tokens.
- **Role-Based Access Control (RBAC)**: Supports roles (`user` vs `admin`) with route guards (`requireRole`).
- **Protected Endpoints**:
  - `GET /api/auth/me`: Accessible by any authenticated user.
  - `GET /api/admin/dashboard`: Strictly restricted to users with `admin` role (returns `403 Forbidden` otherwise).
- **Seed Demo Accounts**: Pre-configured with instant testing accounts.

---

## Pre-Configured Demo Accounts

| Role | Email | Password | Allowed Routes |
|---|---|---|---|
| **Admin** | `admin@example.com` | `AdminPassword123!` | `/api/auth/me`, `/api/admin/dashboard`, `/api/admin/stats` |
| **Standard User** | `user@example.com` | `UserPassword123!` | `/api/auth/me` (blocked from `/api/admin/*`) |

---

## API Endpoints

| Method | Endpoint | Access Level | Description | Status Codes |
|---|---|---|---|---|
| `GET` | `/health` | Public | Healthcheck status | `200` |
| `POST` | `/api/auth/register` | Public | Register new user account | `201`, `400`, `409` |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT | `200`, `400`, `401` |
| `GET` | `/api/auth/me` | Protected (`user` or `admin`) | Current authenticated user profile | `200`, `401` |
| `GET` | `/api/admin/dashboard` | Protected (`admin` only) | Admin metrics & registered users list | `200`, `401`, `403` |

---

## Authentication Flow Walkthrough

```text
[Client] ---> POST /api/auth/register or /login ---> [Auth Service]
                                                           |
                                               Validates & Hashes (bcrypt)
                                                           |
[Client] <--- Returns JWT Token & User Profile <-----------+
   |
   |-- Requests Protected Route with Header:
   |   `Authorization: Bearer <TOKEN>`
   v
[Protected Endpoint] ---> Validates signature & expiry ---> Returns Data (200)
                     ---> If expired / invalid       ---> Returns 401 Unauthorized
                     ---> If role insufficient        ---> Returns 403 Forbidden
```

---

## Sample Requests & Responses (cURL)

### 1. Register a New User
```bash
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Developer",
    "email": "jane@example.com",
    "password": "SecurePassword999!",
    "role": "user"
  }'
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr-1791092800-345",
    "name": "Jane Developer",
    "email": "jane@example.com",
    "role": "user",
    "createdAt": "2026-10-04T12:00:00.000Z"
  }
}
```

---

### 2. Login (Token Issuance)
```bash
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "AdminPassword123!"
  }'
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "id": "usr-admin-1",
    "name": "System Admin",
    "email": "admin@example.com",
    "role": "admin",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### 3. Access Protected Route (`GET /api/auth/me`)
```bash
curl -X GET http://localhost:3003/api/auth/me \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "user": {
    "id": "usr-admin-1",
    "name": "System Admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

---

### 4. RBAC Check: Regular User Trying Admin Route
```bash
# Using a token belonging to a regular user ('role': 'user'):
curl -X GET http://localhost:3003/api/admin/dashboard \
  -H "Authorization: Bearer <REGULAR_USER_TOKEN>"
```
**Response (`403 Forbidden`):**
```json
{
  "success": false,
  "error": "Forbidden: Access denied. Required role(s): [admin], but current role is 'user'"
}
```

---

### 5. RBAC Check: Admin Accessing Admin Route
```bash
# Using an admin token ('role': 'admin'):
curl -X GET http://localhost:3003/api/admin/dashboard \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Welcome to the Protected Admin Control Panel",
  "accessGrantedTo": {
    "id": "usr-admin-1",
    "name": "System Admin",
    "role": "admin"
  },
  "systemStats": {
    "totalRegisteredUsers": 2,
    "adminCount": 1,
    "regularCount": 1,
    "serverUptimeSeconds": 142
  }
}
```

---

### 6. Token Expiry & Unauthorized Handling
**When Token is Missing (`401 Unauthorized`):**
```json
{
  "success": false,
  "error": "Unauthorized: Authorization header is required (Format: Bearer <token>)"
}
```
**When Token is Expired (`401 Unauthorized`):**
```json
{
  "success": false,
  "error": "Unauthorized: Token has expired",
  "expiredAt": "2026-10-04T13:00:00.000Z"
}
```

---

## Local Setup & Installation

```bash
cd JWT-Authentication
npm install
cp .env.example .env
npm test       # Run automated test suite
npm start      # Start server on port 3003
```

---

## Deployment Guide

### Deploy on Render
1. Connect GitHub repository to Render.
2. Root Directory: `JWT-Authentication`.
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. Environment Variables:
   - `JWT_SECRET`: Random 32+ character secret string.
   - `JWT_EXPIRES_IN`: e.g. `1h` or `7d`.
   - `NODE_ENV`: `production`.

### Deploy with Docker
```bash
docker build -t jwt-auth-api .
docker run -p 3003:3003 -e JWT_SECRET=mycustomsecret jwt-auth-api
```
