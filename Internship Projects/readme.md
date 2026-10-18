# Backend Development Internship Projects

A collection of production-ready backend services and application engines demonstrating RESTful API design, relational SQL databases, transactional mutations, real-time WebSocket communication, JWT role-based access control (RBAC), and asynchronous message broker architectures.

---

## 📂 Featured Task Projects (Tasks 2, 3 & 4)

| Task | Dedicated Project Directory | Core Technologies | Description |
|---|---|---|---|
| **Task 2** | [**Secured-Relational-CRUD-API**](./Secured-Relational-CRUD-API) | Node.js, Express, SQLite (Relational), Helmet | Scalable endpoint routing engine handling secure data mutations with relational foreign keys, cascade deletion, ACID transactions, and middleware validation. |
| **Task 3** | [**WebSocket-Realtime-Hub**](./WebSocket-Realtime-Hub) | Node.js, WebSockets (`ws`), Redis / In-Memory Cache | Concurrent real-time communication hub supporting multi-channel chat routing, active user presence caching, and persistent transaction file logging. |
| **Task 4** | [**Microservice-RBAC-MessageBroker**](./Microservice-RBAC-MessageBroker) | Node.js, Express, JWT RBAC, RabbitMQ / In-Memory Broker, Workers, Docker Compose | Modular multi-tier microservice ecosystem handling intense database traffic via asynchronous message queues, decoupled workers, and multi-network container orchestration. |

---

## 📂 Additional Internship Projects

| Project Folder | Core Technology | Description |
|---|---|---|
| [**Simple-REST-API**](./Simple-REST-API) | Node.js, Express, Atomic JSON Storage | Product catalog service featuring full CRUD operations, filtering, search, and containerized deployment configs. |
| [**JWT-Authentication**](./JWT-Authentication) | Node.js, Express, JWT, bcrypt | User authentication and authorization engine implementing Role-Based Access Control (RBAC) and protected routes. |
| [**Pagination-API**](./Pagination-API) | Node.js, Express, Query Filtering | High-performance paginated resource query service with sorting, cursor/offset controls, and validation middleware. |
| [**Contact-Form-Backend**](./Contact-Form-Backend) | Node.js, Express, Nodemailer | Contact form submission processing service with email dispatch and payload validation. |

---

## 🛠 Terminal Setup & Quick Verification

Every project is self-contained with its own dependencies, automated test suites, and terminal demos:

### 1. Task 2: Secured Relational CRUD API Server
```bash
cd "Secured-Relational-CRUD-API"
npm install
npm test          # 18 automated integration tests
npm run cli:demo  # Live terminal demonstration
npm start         # Runs on http://localhost:3002
```

### 2. Task 3: Concurrent WebSocket Real-Time Communication Hub
```bash
cd "WebSocket-Realtime-Hub"
npm install
npm test          # 9 automated integration tests
npm run cli:demo  # Live terminal multi-client simulation
npm run cli:client Alice  # Interactive terminal chat client
npm start         # Runs on ws://localhost:3003
```

### 3. Task 4: Role-Based Microservice API Ecosystem with Message Brokers
```bash
cd "Microservice-RBAC-MessageBroker"
npm install
npm test          # 10 automated verification tests
npm run cli:demo  # Live terminal asynchronous queue demo
npm start         # Runs on http://localhost:3004
```
