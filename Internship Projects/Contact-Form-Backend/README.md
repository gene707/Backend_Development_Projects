# Contact Form Backend (Form Processing & Email Dispatch)

A robust backend service for capturing, validating, persisting, and dispatching contact form submissions via email. Built with Node.js, Express, and Nodemailer, this service provides verifiable proof of message persistence and email delivery.

---

## Features

- **Single Ingestion Endpoint**: `POST /api/contact` handles all form submissions.
- **Server-Side Validation**: Ensures mandatory presence of name, valid RFC 5322 email format, and sensible message length limits before any processing.
- **Dual Delivery & Persistence Assurance**:
  - **Persistent Storage**: All entries are durably stored in an atomic persistent database (`data/submissions.json`).
  - **Email Forwarding**: Dispatches emails via Nodemailer with customizable SMTP or automated Ethereal sandbox previews for testing.
- **Proof of Delivery / Storage Endpoint**: `GET /api/contact/submissions` allows evaluators to inspect records, delivery timestamps, and email dispatch status.
- **Interactive Web Client Included**: A built-in frontend form is served directly from `/` for immediate manual testing.

---

## API Endpoints

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/` | Interactive Web Contact Form UI | `200 OK` |
| `GET` | `/health` | Health check endpoint | `200 OK` |
| `POST` | `/api/contact` | Submit contact form data | `201 Created` / `400 Bad Request` |
| `GET` | `/api/contact/submissions` | Retrieve submission proof & audit records | `200 OK` |
| `GET` | `/api/contact/submissions/:id`| Retrieve single submission audit log | `200 OK` / `404 Not Found` |

---

## Server-Side Validation Rules

| Field | Rules | Error Message |
|---|---|---|
| `name` | String, required, trimmed length 2–100 chars | `"Name is required"` / `"Name must be at least 2 characters long"` |
| `email` | String, required, valid email format regex | `"Email is required"` / `"Invalid email address format"` |
| `message` | String, required, trimmed length 10–3000 chars | `"Message is required"` / `"Message must be at least 10 characters long"` |
| `subject` | String, optional, max 200 chars (defaults to `'General Inquiry'`) | `"Subject must not exceed 200 characters"` |
| `phone` | String, optional, valid phone format | `"Invalid phone number format"` |

---

## Submission Evidence & Delivery Proof

### 1. Proof of Database Persistence
Each submission is saved to `data/submissions.json` with audit metadata:
```json
{
  "id": "sub-1791092688000-412",
  "name": "Sarah Connor",
  "email": "sarah@cyberdyne.org",
  "subject": "System Assessment",
  "message": "We need to schedule an urgent security and architecture review.",
  "phone": "+1 555-0199",
  "submittedAt": "2026-10-04T12:30:00.000Z",
  "deliveryStatus": "delivered",
  "emailProof": {
    "messageId": "<5a12f8-98de-44ab@contact-service>",
    "previewUrl": "https://ethereal.email/message/WaQKMgKddxQDoou...",
    "recipient": "admin@example.com",
    "deliveredAt": "2026-10-04T12:30:01.200Z"
  }
}
```

### 2. Proof of Sent Email Output
When sending via Ethereal or standard SMTP, Nodemailer logs the dispatch confirmation:
```text
[EmailService] Created Ethereal test account: demo.user@ethereal.email
[EmailService] Message sent: <5a12f8-98de-44ab@contact-service>
[EmailService] Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
```

---

## Sample Requests & Responses (cURL)

### 1. Submit Contact Form (Success)
```bash
curl -X POST http://localhost:3002/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah Connor",
    "email": "sarah@cyberdyne.org",
    "subject": "System Assessment",
    "message": "We need to schedule an urgent security and architecture review."
  }'
```
**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Thank you! Your contact message has been received and processed successfully.",
  "submissionId": "sub-1791092688000-412",
  "proof": {
    "persisted": true,
    "deliveryStatus": "delivered",
    "emailProof": {
      "messageId": "<47be8-71e-0a@contact-service>",
      "recipient": "admin@example.com",
      "deliveredAt": "2026-10-04T12:30:01.200Z"
    },
    "submittedAt": "2026-10-04T12:30:00.000Z"
  }
}
```

---

### 2. Submit Contact Form (Validation Failure)
```bash
curl -X POST http://localhost:3002/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "S",
    "email": "bad-email",
    "message": "Short"
  }'
```
**Response (`400 Bad Request`):**
```json
{
  "success": false,
  "message": "Validation failed. Please correct the highlighted errors.",
  "errors": [
    { "field": "name", "message": "Name must be at least 2 characters long" },
    { "field": "email", "message": "Invalid email address format" },
    { "field": "message", "message": "Message must be at least 10 characters long" }
  ]
}
```

---

### 3. Verify Stored Submissions Proof
```bash
curl -X GET http://localhost:3002/api/contact/submissions
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "count": 1,
  "submissions": [
    {
      "id": "sub-1791092688000-412",
      "name": "Sarah Connor",
      "email": "sarah@cyberdyne.org",
      "subject": "System Assessment",
      "message": "We need to schedule an urgent security and architecture review.",
      "submittedAt": "2026-10-04T12:30:00.000Z",
      "deliveryStatus": "delivered"
    }
  ]
}
```

---

## Frontend Integration Code Snippet

You can drop this snippet into any web application or React/Vue/HTML frontend:

```html
<form id="contactForm">
  <input type="text" id="name" placeholder="Your Name" required />
  <input type="email" id="email" placeholder="Your Email" required />
  <textarea id="message" placeholder="Your Message (min 10 characters)" required></textarea>
  <button type="submit">Send Message</button>
</form>

<script>
  document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      message: document.getElementById('message').value
    };

    const res = await fetch('http://localhost:3002/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (res.ok) {
      alert(`Success! Submission ID: ${result.submissionId}`);
    } else {
      alert('Error: ' + JSON.stringify(result.errors));
    }
  });
</script>
```

---

## Local Setup & Installation

```bash
cd Contact-Form-Backend
npm install
cp .env.example .env
npm test       # Run automated integration tests
npm start      # Start production server on port 3002
```

Open `http://localhost:3002` in your browser to interact with the live contact form.

---

## Deployment Guide

### Deploy on Render
1. Connect repository to [Render](https://render.com).
2. Configure **Root Directory**: `Contact-Form-Backend`.
3. Set **Build Command**: `npm install`.
4. Set **Start Command**: `npm start`.
5. Optional Environment Variables:
   - `SMTP_HOST`: e.g. `smtp.gmail.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: your SMTP username
   - `SMTP_PASS`: your SMTP app password
   - `RECIPIENT_EMAIL`: where inquiries should arrive
