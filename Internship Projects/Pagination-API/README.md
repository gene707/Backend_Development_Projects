# Pagination API (Paginated Listing & Filtering Service)

A high-performance, robust RESTful listing service built with Node.js and Express. It features comprehensive pagination (page-based & offset-based), multi-field sorting, multiple filter parameters, and resilient edge-case handling for out-of-range pages and malformed parameters.

---

## Features

- **Pagination Controls**:
  - `page`: Specific page index (default: `1`, min: `1`).
  - `limit`: Number of items per page (default: `10`, range: `1` to `50`).
  - `offset`: Optional alternative offset-based parameter.
- **Detailed Pagination Metadata**:
  - `currentPage`, `totalPages`, `totalItems`, `itemsPerPage`, `itemCountOnPage`.
  - Navigation indicators: `hasNextPage`, `hasPrevPage`, `nextPage`, `prevPage`.
- **Filtering Options**:
  - `category`: Filter by category (e.g. `Technology`, `Science`, `Fiction`).
  - `search` / `q`: Case-insensitive text search across title, author, and description.
  - `minPrice` & `maxPrice`: Numeric price range boundaries.
  - `minRating`: Minimum customer rating filter (0.0 to 5.0).
- **Sorting Options**:
  - `sortBy`: Field to order by (`id`, `title`, `author`, `category`, `price`, `rating`, `year`).
  - `sortOrder`: Direction (`asc` or `desc`).
- **Resilient Edge Case Handling**:
  - **Out-of-range page** (e.g., `page=999` when only 5 pages exist): Returns `200 OK` with an empty `data: []` list, `isOutOfRange: true`, and a human-readable guidance message.
  - **Invalid query parameters** (e.g., `page=-1`, `limit=500`, invalid field names): Returns `400 Bad Request` with an exact array of parameter validation errors.

---

## API Endpoints

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/health` | Service health status | `200` |
| `GET` | `/api/items` | Paginated listing with filtering and sorting | `200`, `400` |
| `GET` | `/api/items/:id` | Retrieve single item by ID | `200`, `404` |
| `GET` | `/api/categories` | Summary of categories and item counts | `200` |

---

## Query Parameters Reference

| Parameter | Type | Default | Description | Example |
|---|---|---|---|---|
| `page` | Integer | `1` | Page number to retrieve (>= 1) | `?page=2` |
| `limit` | Integer | `10` | Records per page (1 to 50) | `?limit=5` |
| `offset` | Integer | - | Alternative offset index | `?offset=20` |
| `category` | String | - | Case-insensitive category match | `?category=Technology` |
| `search` / `q` | String | - | Keyword search across title/author | `?search=clean` |
| `minPrice` | Number | - | Lower bound on item price | `?minPrice=20` |
| `maxPrice` | Number | - | Upper bound on item price | `?maxPrice=50` |
| `minRating` | Number | - | Minimum rating filter | `?minRating=4.8` |
| `sortBy` | String | `id` | Sort attribute | `?sortBy=price` |
| `sortOrder` | String | `asc` | Sort direction (`asc` or `desc`) | `?sortOrder=desc` |

---

## Sample Requests & Responses (cURL)

### 1. Basic Pagination Request (Page 2 with Limit 5)
```bash
curl -X GET "http://localhost:3004/api/items?page=2&limit=5"
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "pagination": {
    "currentPage": 2,
    "totalPages": 10,
    "totalItems": 50,
    "itemsPerPage": 5,
    "itemCountOnPage": 5,
    "hasNextPage": true,
    "hasPrevPage": true,
    "nextPage": 3,
    "prevPage": 1,
    "isOutOfRange": false
  },
  "filtersApplied": {
    "category": null,
    "search": null,
    "minPrice": null,
    "maxPrice": null,
    "minRating": null,
    "sortBy": "id",
    "sortOrder": "asc"
  },
  "data": [
    { "id": 6, "title": "Designing Data-Intensive Applications", "author": "Martin Kleppmann", "category": "Technology", "price": 49.95, "rating": 4.9, "year": 2017 },
    { "id": 7, "title": "Introduction to Algorithms (CLRS)", "author": "Thomas H. Cormen", "category": "Technology", "price": 89.99, "rating": 4.6, "year": 2022 },
    { "id": 8, "title": "You Don't Know JS Yet: Get Started", "author": "Kyle Simpson", "category": "Technology", "price": 24.95, "rating": 4.7, "year": 2020 },
    { "id": 9, "title": "JavaScript: The Good Parts", "author": "Douglas Crockford", "category": "Technology", "price": 29.99, "rating": 4.4, "year": 2008 },
    { "id": 10, "title": "Cracking the Coding Interview", "author": "Gayle Laakmann McDowell", "category": "Technology", "price": 38.00, "rating": 4.7, "year": 2015 }
  ]
}
```

---

### 2. Filtering & Sorting Combination
```bash
curl -X GET "http://localhost:3004/api/items?category=Technology&minRating=4.8&sortBy=price&sortOrder=desc"
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 4,
    "itemsPerPage": 10,
    "itemCountOnPage": 4,
    "hasNextPage": false,
    "hasPrevPage": false,
    "nextPage": null,
    "prevPage": null,
    "isOutOfRange": false
  },
  "filtersApplied": {
    "category": "Technology",
    "search": null,
    "minPrice": null,
    "maxPrice": null,
    "minRating": 4.8,
    "sortBy": "price",
    "sortOrder": "desc"
  },
  "data": [
    { "id": 4, "title": "Structure and Interpretation of Computer Programs", "author": "Harold Abelson", "category": "Technology", "price": 65.00, "rating": 4.8, "year": 1996 },
    { "id": 6, "title": "Designing Data-Intensive Applications", "author": "Martin Kleppmann", "category": "Technology", "price": 49.95, "rating": 4.9, "year": 2017 },
    { "id": 2, "title": "The Pragmatic Programmer: Your Journey To Mastery", "author": "Andrew Hunt & David Thomas", "category": "Technology", "price": 48.00, "rating": 4.9, "year": 2019 },
    { "id": 5, "title": "Refactoring: Improving the Design of Existing Code", "author": "Martin Fowler", "category": "Technology", "price": 47.50, "rating": 4.8, "year": 2018 }
  ]
}
```

---

### 3. Edge Case: Out-of-Range Page Request
```bash
curl -X GET "http://localhost:3004/api/items?page=999"
```
**Response (`200 OK` with empty list and warning):**
```json
{
  "success": true,
  "pagination": {
    "currentPage": 999,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10,
    "itemCountOnPage": 0,
    "hasNextPage": false,
    "hasPrevPage": true,
    "nextPage": null,
    "prevPage": 998,
    "isOutOfRange": true
  },
  "filtersApplied": {
    "category": null,
    "search": null,
    "minPrice": null,
    "maxPrice": null,
    "minRating": null,
    "sortBy": "id",
    "sortOrder": "asc"
  },
  "message": "Requested page (999) is out of range. Total available pages for this query is 5.",
  "data": []
}
```

---

### 4. Edge Case: Invalid Parameter Input
```bash
curl -X GET "http://localhost:3004/api/items?page=-3&limit=500&sortBy=nonExistentField"
```
**Response (`400 Bad Request`):**
```json
{
  "success": false,
  "message": "Invalid pagination or filter query parameters",
  "errors": [
    {
      "parameter": "page",
      "message": "Parameter \"page\" must be a positive integer greater than or equal to 1"
    },
    {
      "parameter": "limit",
      "message": "Parameter \"limit\" must be an integer between 1 and 50"
    },
    {
      "parameter": "sortBy",
      "message": "Invalid sortBy field 'nonExistentField'. Allowed fields are: id, title, author, category, price, rating, year"
    }
  ]
}
```

---

## Local Setup & Installation

```bash
cd Pagination-API
npm install
cp .env.example .env
npm test       # Run automated test suite
npm start      # Start server on port 3004
```

---

## Deployment Guide

### Deploy on Render
1. Push to GitHub and log in to [Render](https://render.com).
2. Connect repository with blueprint `Pagination-API/render.yaml` or create Web Service:
   - Root Directory: `Pagination-API`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Port: `10000`

### Deploy with Docker
```bash
docker build -t pagination-api .
docker run -p 3004:3004 pagination-api
```
