<div align="center">

<h1 align="center">🧠 MeetOnMemory</h1>

![GitHub stars](https://img.shields.io/github/stars/imuniqueshiv/MeetOnMemory?style=for-the-badge)
![GitHub forks](https://img.shields.io/github/forks/imuniqueshiv/MeetOnMemory?style=for-the-badge)
![GitHub issues](https://img.shields.io/github/issues/imuniqueshiv/MeetOnMemory?style=for-the-badge)
![GitHub pull requests](https://img.shields.io/github/issues-pr/imuniqueshiv/MeetOnMemory?style=for-the-badge)
![License](https://img.shields.io/github/license/imuniqueshiv/MeetOnMemory?style=for-the-badge)

### AI-Powered Meeting Memory & Management Platform

Transform meetings, discussions, and organizational knowledge into a searchable and structured repository using AI.

![React](https://img.shields.io/badge/React-19-blue)
![Node.js](https://img.shields.io/badge/Node.js-20-green)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green)
![Express](https://img.shields.io/badge/Express.js-Backend-black)
![Vite](https://img.shields.io/badge/Vite-Frontend-purple)
![Gemini](https://img.shields.io/badge/Google-Gemini-blue)

</div>

---

## Overview

MeetOnMemory is a full-stack AI-powered platform built to address the challenge of meeting management, policy tracking, and institutional knowledge retention.

Organizations often lose valuable information because meeting notes, decisions, policies, and discussions are scattered across emails, documents, and chats. MeetOnMemory centralizes this information and makes it searchable through AI-powered semantic search and automated meeting summaries.

---

## Problem Statement

Develop a centralized system to manage meetings, events, and policy records while improving:

- Knowledge retention
- Accountability
- Documentation
- Information retrieval
- Organizational transparency

MeetOnMemory provides a single platform where organizations can store, manage, search, and analyze meeting-related information.

---

# Features

## Meeting Management

- Create meetings
- Manage meeting details and agenda
- Track meeting history
- Organize discussions in one place

## AI Meeting Summaries

- Generate Minutes of Meeting (MoM)
- Extract key discussion points
- Capture decisions
- Generate structured summaries using Google Gemini

## Semantic Search

Search organizational knowledge using natural language queries.

Examples:

```text
What was decided about the education policy?

Show discussions related to AI implementation.

Find previous meetings discussing recruitment.
```

Powered by:

- Pinecone Vector Database
- Embeddings
- AI-based similarity search

## Policy Repository

- Upload policy documents
- Maintain policy versions
- Store organizational records
- Centralized policy management

## Reports & Analytics

- Meeting statistics
- Policy activity tracking
- Organization insights
- Visual dashboards

## Authentication & Security

- Clerk identity provider (sole login/session provider)
- MongoDB-backed organizations, memberships, roles, and RBAC
- Protected routes and permission middleware
- Secondary JWTs for shared links, Slack OAuth state, and data exports (not user login)

## Real-Time Communication

- Socket.IO integration
- Real-time updates
- Live meeting interactions

## Organization Management

- Create organizations
- Join organizations
- Role-based access management

---

# System Architecture

```text
Frontend (React + Vite)
            │
            ▼
Backend (Node.js + Express)
            │
            ▼
MongoDB Database
            │
 ┌──────────┴──────────┐
 ▼                     ▼

Google Gemini      Pinecone

AI Summaries     Semantic Search
```

---

# Tech Stack

## Frontend

- React.js
- Vite
- Tailwind CSS
- React Router DOM
- Axios
- Recharts
- Chart.js
- Lucide React
- React Toastify
- React Speech Recognition
- Socket.IO Client

## Backend

- Node.js
- Express.js
- Socket.IO
- Clerk (`@clerk/express`) for identity
- MongoDB RBAC for authorization
- Multer
- Nodemailer
- Cookie Parser
- CORS

## Database

- MongoDB
- Mongoose

## AI & Search

- Google Gemini API
- Pinecone
- Hugging Face Inference API
- ChromaDB
- Xenova Transformers
- ONNX Runtime
- OpenAI SDK (Optional)

## Integrations

- Google APIs
- Microsoft Graph API
- Calendar Utilities
- Email Services

---

# Project Structure

```text
MeetOnMemory
│
├── client
│   ├── public
│   ├── src
│   │   ├── assets
│   │   ├── components
│   │   ├── context
│   │   └── pages
│   └── package.json
│
├── server
│   ├── config
│   ├── controllers
│   ├── middleware
│   ├── models
│   ├── routes
│   ├── services
│   ├── socket
│   ├── uploads
│   ├── utils
│   └── server.js
│
├── package.json
└── README.md
```

---

# Screenshots

## Dashboard

![Dashboard](./screenshots/Dashboard.jpeg)

## Meeting Management

![Meeting Management](./screenshots/Meeting-management.jpeg)

## Reports & Analytics

![Analytics](./screenshots/Report-analytics.jpeg)

---

# Installation

## Clone Repository

```bash
git clone https://github.com/imuniqueshiv/MeetOnMemory.git

cd MeetOnMemory
```

## Docker Setup (Recommended)

The easiest way to run the entire stack (Database, Redis, Backend, Frontend) locally is using Docker.

1. Make sure you have Docker and Docker Compose installed.
2. Create `.env` files for both the client and server (see Environment Variables section).
3. Run the following command from the root directory:

```bash
docker-compose up -d --build
```

This will spin up all the necessary services.

- The frontend will be available at `http://localhost:5173`
- The backend will be available at `http://localhost:4000`

---

## Manual Backend Setup

```bash
cd server

npm install
```

Create `.env`

```env
PORT=4000

MONGODB_URI=your_mongodb_uri

# Clerk — sole identity provider (required)
AUTH_PROVIDER=clerk
CLERK_SECRET_KEY=sk_test_your_clerk_secret

# Secondary token signing ONLY (shared links, Slack OAuth state, data exports).
# Not used for user login sessions.
JWT_SECRET=your_secondary_jwt_secret

NODE_ENV=development

CLIENT_URL=http://localhost:5173

SMTP_USER=your_email

SMTP_PASS=your_password

SENDER_EMAIL=your_email

ASSEMBLYAI_API_KEY=your_key

OPENAI_API_KEY=optional

HUGGINGFACE_API_KEY=your_key

GEMINI_API_KEY=your_key

GEMINI_MODEL=gemini-2.0-flash

PINECONE_API_KEY=your_key

PINECONE_ENVIRONMENT=your_environment

INDEX_NAME=your_index_name

TRANSFORMERS_BACKEND=onnxruntime-web

# Calendar Integrations
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/calendar/google/callback

MS_CLIENT_ID=your_microsoft_client_id
MS_CLIENT_SECRET=your_microsoft_client_secret
MS_TENANT_ID=common
MS_REDIRECT_URI=http://localhost:4000/api/calendar/outlook/callback

TOKEN_ENCRYPTION_KEY=32_byte_string_for_encryption
```

Start Backend:

```bash
npm run server
```

---

## Manual Frontend Setup (Zero-Configuration)

The frontend features automatic backend resolution and works out-of-the-box without manual environment configuration:

```bash
cd client

npm install
```

Create `client/.env` (required for Clerk):

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
# Local development (required protocol: http — not https)
VITE_BACKEND_URL=http://localhost:4000
# Production
# VITE_BACKEND_URL=https://meetonmemory.onrender.com
```

```bash
npm run dev
```

> **Note**: `VITE_CLERK_PUBLISHABLE_KEY` is required. Without it, sign-in/sign-up are unavailable. If `VITE_BACKEND_URL` is unset, the frontend falls back to `http://localhost:4000`.

---

# Environment Variables

### Server

| Variable             | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| PORT                 | Server Port                                                    |
| MONGODB_URI          | MongoDB Connection                                             |
| AUTH_PROVIDER        | Must be `clerk` (sole identity provider)                       |
| CLERK_SECRET_KEY     | Clerk secret key for session verification                      |
| JWT_SECRET           | Secondary token signing (shared links / Slack state / exports) |
| CLIENT_URL           | Frontend origin for OAuth redirects                            |
| GEMINI_API_KEY       | Google Gemini                                                  |
| GEMINI_MODEL         | Gemini Model                                                   |
| PINECONE_API_KEY     | Pinecone Access                                                |
| PINECONE_ENVIRONMENT | Pinecone Environment                                           |
| INDEX_NAME           | Pinecone Index                                                 |
| HUGGINGFACE_API_KEY  | Embeddings                                                     |
| ASSEMBLYAI_API_KEY   | Speech Processing                                              |
| SMTP_USER            | Email Service                                                  |
| SMTP_PASS            | Email Service                                                  |
| SENDER_EMAIL         | Sender Email                                                   |

### Client

| Variable                   | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| VITE_CLERK_PUBLISHABLE_KEY | Clerk publishable key (required for sign-in)  |
| VITE_BACKEND_URL           | Backend API URL (optional; defaults to :4000) |

---

# Future Improvements

- Live Meeting Recording
- Real-Time Speech Transcription
- Voice Search
- Google Calendar Integration
- Outlook Integration
- AI Meeting Assistant
- Slack Integration
- Multi-Language Support
- Mobile Application

---

# Use Cases

### Organizations

Store and retrieve meeting knowledge efficiently.

### Educational Institutions

Manage meetings, events, and policy records.

### Research Teams

Maintain searchable archives of discussions and decisions.

### Startups

Track decisions, action items, and organizational growth.

---

# 💖 Contributors

Thanks to all the amazing contributors who have helped improve MeetOnMemory!

<div align="center">
<!-- CONTRIBUTORS:START -->

## 🏆 Hall of Fame

<table align="center">
<tr>

<td align="center" width="20%" valign="top">

### 🥇

<a href="https://github.com/imuniqueshiv">
  <img
    src="https://github.com/imuniqueshiv.png"
    width="96"
    height="96"
    alt="@imuniqueshiv"
    style="border-radius:50%;"
  />
</a>

<br/><br/>

<strong>
<a href="https://github.com/imuniqueshiv">
@imuniqueshiv
</a>
</strong>

<br/>

🔀 <strong>703</strong> Merged PRs

<br/>

⭐ <strong>703</strong> Commits

</td>
</tr>
</table>

## ❤️ All Contributors

<div align="center">

<a href="https://github.com/imuniqueshiv"><img src="https://github.com/imuniqueshiv.png" width="64" height="64" alt="@imuniqueshiv" title="@imuniqueshiv" style="border-radius:50%;margin:6px;"/></a>

</div>

<!-- CONTRIBUTORS:END -->
</div>

---

# License

This project is licensed under the MIT License.

---

# ⭐ Support

If you find **MeetOnMemory** useful, please consider:

⭐ Star this repository

🍴 Fork the project

🐛 Report bugs

💡 Suggest new features

🤝 Contribute to the project

---

<p align="center">
  <b>Built with passion, powered by AI, shipped with precision.</b>
</p>

<p align="center">
  ⭐ If MeetOnMemory helps you, consider giving this repository a star! ⭐
</p>

<p align="center">
  <b>Proud participant of Elite Coders Summer of Code (ECSoC) 2026.</b>
</p>

---

<p align="center">
Made with ❤️ by the MeetOnMemory Community
</p>
