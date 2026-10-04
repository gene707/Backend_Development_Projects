# Simple REST API — Product Catalog Service

A lightweight, production-ready RESTful API service built with Node.js and Express. It provides full CRUD (Create, Read, Update, Delete) operations for managing a product inventory with persistent JSON-backed atomic storage, rigorous input validation, standardized JSON error responses, and containerized deployment configs.

---

## Features

- **Full CRUD Capabilities**: Create, read (all and single), full/partial update, and delete products.
- **Persistent Storage**: Data persisted to disk with atomic file writes to prevent race conditions or data loss.
- **Input Validation**: Validates required fields, data types, string length, and non-negative numbers before processing.
- **REST Best Practices**: Standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`).
- **Filtering & Search**: Filter products by category or search by keywords in product name/description.
- **Deployment Ready**: Includes `Dockerfile`, `render.yaml`, and environment configuration.

---

## Resource Schema: Product

| Field | Type | Description | Required on Create |
|---|---|---|---|
| `id` | String | Unique product identifier (e.g. `prod-1`) | Auto-generated |
| `name` | String | Name of the product (max 150 chars) | Yes |
| `description` | String | Detailed product description | No |
| `price` | Number | Unit price (positive float/integer) | Yes |
| `category` | String | Product category (e.g. `Electronics`) | Yes |
| `stock` | Number | Quantity in inventory (default: 0) | No |
| `createdAt` | String | ISO 8601 creation timestamp | Auto-generated |
| `updatedAt` | String | ISO 8601 last modified timestamp | Auto-generated |

---

## API Endpoints

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/health` | Service health status check | `200 OK` |
| `GET` | `/api/products` | Retrieve all products (supports `?category=` and `?q=`) | `200 OK` |
| `GET` | `/api/products/:id` | Retrieve a single product by ID | `200 OK` / `404 Not Found` |
| `POST` | `/api/products` | Create a new product | `201 Created` / `400 Bad Request` |
| `PUT` | `/api/products/:id` | Replace / Full update of a product | `200 OK` / `404` / `400` |
| `PATCH` | `/api/products/:id` | Partial update of specific fields | `200 OK` / `404` / `400` |
| `DELETE` | `/api/products/:id` | Delete a product by ID | `200 OK` / `404 Not Found` |

---

## Sample Requests & Responses (cURL)

### 1. Health Check
```bash
curl -X GET http://localhost:3001/health
```
**Response (`200 OK`):**
```json
{
  "status": "UP",
  "service": "Simple REST API (Product List)",
  "timestamp": "2026-10-04T12:00:00.000Z"
}
```

---

### 2. List All Products
```bash
curl -X GET http://localhost:3001/api/products
```
**With Query Filters:**
```bash
curl -X GET "http://localhost:3001/api/products?category=Electronics&q=headphones"
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "prod-1",
      "name": "Wireless Noise-Canceling Headphones",
      "description": "High-fidelity audio with active noise cancellation and 30-hour battery life.",
      "price": 199.99,
      "category": "Electronics",
      "stock": 45,
      "createdAt": "2026-01-15T08:30:00.000Z",
      "updatedAt": "2026-01-15T08:30:00.000Z"
    }
  ]
}
```

---

### 3. Get Single Product
```bash
curl -X GET http://localhost:3001/api/products/prod-1
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "prod-1",
    "name": "Wireless Noise-Canceling Headphones",
    "description": "High-fidelity audio with active noise cancellation and 30-hour battery life.",
    "price": 199.99,
    "category": "Electronics",
    "stock": 45,
    "createdAt": "2026-01-15T08:30:00.000Z",
    "updatedAt": "2026-01-15T08:30:00.000Z"
  }
}
```

---

### 4. Create Product
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Ergonomic Mouse",
    "description": "Bluetooth ergonomic mouse with silent clicks",
    "price": 49.99,
    "category": "Computers",
    "stock": 75
  }'
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": "prod-1728042000-842",
    "name": "Wireless Ergonomic Mouse",
    "description": "Bluetooth ergonomic mouse with silent clicks",
    "price": 49.99,
    "category": "Computers",
    "stock": 75,
    "createdAt": "2026-10-04T12:00:00.000Z",
    "updatedAt": "2026-10-04T12:00:00.000Z"
  }
}
```

---

### 5. Update Product (PUT)
```bash
curl -X PUT http://localhost:3001/api/products/prod-1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Noise-Canceling Headphones Gen 2",
    "description": "Upgraded 40-hour battery with ultra-fast charging",
    "price": 229.99,
    "category": "Electronics",
    "stock": 60
  }'
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": "prod-1",
    "name": "Wireless Noise-Canceling Headphones Gen 2",
    "description": "Upgraded 40-hour battery with ultra-fast charging",
    "price": 229.99,
    "category": "Electronics",
    "stock": 60,
    "createdAt": "2026-01-15T08:30:00.000Z",
    "updatedAt": "2026-10-04T12:05:00.000Z"
  }
}
```

---

### 6. Partial Update (PATCH)
```bash
curl -X PATCH http://localhost:3001/api/products/prod-1 \
  -H "Content-Type: application/json" \
  -d '{"price": 189.99, "stock": 55}'
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Product partially updated successfully",
  "data": {
    "id": "prod-1",
    "name": "Wireless Noise-Canceling Headphones Gen 2",
    "price": 189.99,
    "stock": 55,
    "updatedAt": "2026-10-04T12:06:00.000Z"
  }
}
```

---

### 7. Delete Product
```bash
curl -X DELETE http://localhost:3001/api/products/prod-1
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Product deleted successfully",
  "data": {
    "id": "prod-1",
    "name": "Wireless Noise-Canceling Headphones Gen 2"
  }
}
```

---

### 8. Validation Error Example
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -d '{"price": -10}'
```
**Response (`400 Bad Request`):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "Name is required and must be a non-empty string" },
    { "field": "price", "message": "Price is required and must be a positive number" },
    { "field": "category", "message": "Category is required and must be a non-empty string" }
  ]
}
```

---

## Local Setup & Installation

### Prerequisites
- Node.js (v18.0 or newer)
- npm (v9.0 or newer)

### Steps
1. Navigate to the project folder:
   ```bash
   cd Simple-REST-API
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Run integration tests:
   ```bash
   npm test
   ```
5. Start development server:
   ```bash
   npm run dev
   ```
6. Start production server:
   ```bash
   npm start
   ```
   The API will be available at `http://localhost:3001`.

---

## Deployment Guide

### Option 1: Deploy on Render
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com).
3. Click **New +** -> **Blueprint** and connect your GitHub repo, pointing to `Simple-REST-API/render.yaml`.
4. Alternatively, create a **Web Service**:
   - **Root Directory**: `Simple-REST-API`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: `PORT=10000`, `NODE_ENV=production`

### Option 2: Deploy with Docker
Build and run the container:
```bash
docker build -t simple-rest-api .
docker run -p 3001:3001 --name rest-api-app simple-rest-api
```

### Option 3: Deploy on Railway
1. Sign in to [Railway](https://railway.app).
2. Create **New Project** -> **Deploy from GitHub repo**.
3. Set root directory to `Simple-REST-API` and deploy.
