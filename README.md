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

- JWT Authentication
- Protected Routes
- Password Hashing (bcrypt)
- Secure API Access

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
- JWT Authentication
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

JWT_SECRET=your_secret

NODE_ENV=development

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
```

Start Backend:

```bash
npm run server
```

---

## Manual Frontend Setup

```bash
cd client

npm install
```

Create `.env`

```env
VITE_BACKEND_URL=http://localhost:4000
```

Run Frontend:

```bash
npm run dev
```

---

# Environment Variables

### Server

| Variable             | Purpose               |
| -------------------- | --------------------- |
| PORT                 | Server Port           |
| MONGODB_URI          | MongoDB Connection    |
| JWT_SECRET           | Authentication Secret |
| GEMINI_API_KEY       | Google Gemini         |
| GEMINI_MODEL         | Gemini Model          |
| PINECONE_API_KEY     | Pinecone Access       |
| PINECONE_ENVIRONMENT | Pinecone Environment  |
| INDEX_NAME           | Pinecone Index        |
| HUGGINGFACE_API_KEY  | Embeddings            |
| ASSEMBLYAI_API_KEY   | Speech Processing     |
| SMTP_USER            | Email Service         |
| SMTP_PASS            | Email Service         |
| SENDER_EMAIL         | Sender Email          |

### Client

| Variable         | Purpose         |
| ---------------- | --------------- |
| VITE_BACKEND_URL | Backend API URL |

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

<a href="https://github.com/mrunmayeekokitkar">
  <img
    src="https://avatars.githubusercontent.com/u/184808271?v=4"
    width="96"
    height="96"
    alt="@mrunmayeekokitkar"
    style="border-radius:50%;"
  />
</a>

<br/><br/>

<strong>
<a href="https://github.com/mrunmayeekokitkar">
@mrunmayeekokitkar
</a>
</strong>

<br/>

🔀 <strong>32</strong> Merged PRs

<br/>

⭐ <strong>84</strong> Commits

</td>
<td align="center" width="20%" valign="top">

### 🥈

<a href="https://github.com/ErebAsh">
  <img
    src="https://avatars.githubusercontent.com/u/156138261?v=4"
    width="96"
    height="96"
    alt="@ErebAsh"
    style="border-radius:50%;"
  />
</a>

<br/><br/>

<strong>
<a href="https://github.com/ErebAsh">
@ErebAsh
</a>
</strong>

<br/>

🔀 <strong>26</strong> Merged PRs

<br/>

⭐ <strong>48</strong> Commits

</td>
<td align="center" width="20%" valign="top">

### 🥉

<a href="https://github.com/Chirag1724">
  <img
    src="https://avatars.githubusercontent.com/u/197275459?v=4"
    width="96"
    height="96"
    alt="@Chirag1724"
    style="border-radius:50%;"
  />
</a>

<br/><br/>

<strong>
<a href="https://github.com/Chirag1724">
@Chirag1724
</a>
</strong>

<br/>

🔀 <strong>9</strong> Merged PRs

<br/>

⭐ <strong>22</strong> Commits

</td>
<td align="center" width="20%" valign="top">

### 4

<a href="https://github.com/dipanshubatra">
  <img
    src="https://avatars.githubusercontent.com/u/209317047?v=4"
    width="96"
    height="96"
    alt="@dipanshubatra"
    style="border-radius:50%;"
  />
</a>

<br/><br/>

<strong>
<a href="https://github.com/dipanshubatra">
@dipanshubatra
</a>
</strong>

<br/>

🔀 <strong>5</strong> Merged PRs

<br/>

⭐ <strong>15</strong> Commits

</td>
<td align="center" width="20%" valign="top">

### 5

<a href="https://github.com/revatikadam0607">
  <img
    src="https://avatars.githubusercontent.com/u/261348571?v=4"
    width="96"
    height="96"
    alt="@revatikadam0607"
    style="border-radius:50%;"
  />
</a>

<br/><br/>

<strong>
<a href="https://github.com/revatikadam0607">
@revatikadam0607
</a>
</strong>

<br/>

🔀 <strong>5</strong> Merged PRs

<br/>

⭐ <strong>9</strong> Commits

</td>
</tr>
</table>

## ❤️ All Contributors

<div align="center">

<a href="https://github.com/mrunmayeekokitkar"><img src="https://avatars.githubusercontent.com/u/184808271?v=4" width="64" height="64" alt="@mrunmayeekokitkar" title="@mrunmayeekokitkar" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/ErebAsh"><img src="https://avatars.githubusercontent.com/u/156138261?v=4" width="64" height="64" alt="@ErebAsh" title="@ErebAsh" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Chirag1724"><img src="https://avatars.githubusercontent.com/u/197275459?v=4" width="64" height="64" alt="@Chirag1724" title="@Chirag1724" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/dipanshubatra"><img src="https://avatars.githubusercontent.com/u/209317047?v=4" width="64" height="64" alt="@dipanshubatra" title="@dipanshubatra" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/revatikadam0607"><img src="https://avatars.githubusercontent.com/u/261348571?v=4" width="64" height="64" alt="@revatikadam0607" title="@revatikadam0607" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Kashvi108"><img src="https://avatars.githubusercontent.com/u/287214039?v=4" width="64" height="64" alt="@Kashvi108" title="@Kashvi108" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/shivi14112007-create"><img src="https://avatars.githubusercontent.com/u/230695900?v=4" width="64" height="64" alt="@shivi14112007-create" title="@shivi14112007-create" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Pratyush-Panda-2006"><img src="https://avatars.githubusercontent.com/u/210313441?v=4" width="64" height="64" alt="@Pratyush-Panda-2006" title="@Pratyush-Panda-2006" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/M0izz"><img src="https://avatars.githubusercontent.com/u/180389597?v=4" width="64" height="64" alt="@M0izz" title="@M0izz" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Diwakar-odds"><img src="https://avatars.githubusercontent.com/u/170966675?v=4" width="64" height="64" alt="@Diwakar-odds" title="@Diwakar-odds" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Payal29037"><img src="https://avatars.githubusercontent.com/u/185815252?v=4" width="64" height="64" alt="@Payal29037" title="@Payal29037" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Twinklekumari2"><img src="https://avatars.githubusercontent.com/u/180191992?v=4" width="64" height="64" alt="@Twinklekumari2" title="@Twinklekumari2" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/IshwinderKaur8"><img src="https://avatars.githubusercontent.com/u/186953726?v=4" width="64" height="64" alt="@IshwinderKaur8" title="@IshwinderKaur8" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Aryanbuha890"><img src="https://avatars.githubusercontent.com/u/273169945?v=4" width="64" height="64" alt="@Aryanbuha890" title="@Aryanbuha890" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Aaryanvyas"><img src="https://avatars.githubusercontent.com/u/188873438?v=4" width="64" height="64" alt="@Aaryanvyas" title="@Aaryanvyas" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/itxhadi27-cmd"><img src="https://avatars.githubusercontent.com/u/222145496?v=4" width="64" height="64" alt="@itxhadi27-cmd" title="@itxhadi27-cmd" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/BhaveshGadling77"><img src="https://avatars.githubusercontent.com/u/188820144?v=4" width="64" height="64" alt="@BhaveshGadling77" title="@BhaveshGadling77" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/harshitha9626"><img src="https://avatars.githubusercontent.com/u/212395044?v=4" width="64" height="64" alt="@harshitha9626" title="@harshitha9626" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/sunny-4"><img src="https://avatars.githubusercontent.com/u/160472583?v=4" width="64" height="64" alt="@sunny-4" title="@sunny-4" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/itsaditi05"><img src="https://avatars.githubusercontent.com/u/175183822?v=4" width="64" height="64" alt="@itsaditi05" title="@itsaditi05" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/palakgoda"><img src="https://avatars.githubusercontent.com/u/206355231?v=4" width="64" height="64" alt="@palakgoda" title="@palakgoda" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/priymavani"><img src="https://avatars.githubusercontent.com/u/177344452?v=4" width="64" height="64" alt="@priymavani" title="@priymavani" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/bhavana-career"><img src="https://avatars.githubusercontent.com/u/255297132?v=4" width="64" height="64" alt="@bhavana-career" title="@bhavana-career" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/piush365"><img src="https://avatars.githubusercontent.com/u/173165525?v=4" width="64" height="64" alt="@piush365" title="@piush365" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/Khushi1310-nayak"><img src="https://avatars.githubusercontent.com/u/221927504?v=4" width="64" height="64" alt="@Khushi1310-nayak" title="@Khushi1310-nayak" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/CodeWithShrey-collab"><img src="https://avatars.githubusercontent.com/u/179368106?v=4" width="64" height="64" alt="@CodeWithShrey-collab" title="@CodeWithShrey-collab" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/BikramMondal5"><img src="https://avatars.githubusercontent.com/u/170235967?v=4" width="64" height="64" alt="@BikramMondal5" title="@BikramMondal5" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/imuniqueshiv"><img src="https://avatars.githubusercontent.com/u/144125626?v=4" width="64" height="64" alt="@imuniqueshiv" title="@imuniqueshiv" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/aadhish-saini"><img src="https://avatars.githubusercontent.com/u/278401462?v=4" width="64" height="64" alt="@aadhish-saini" title="@aadhish-saini" style="border-radius:50%;margin:6px;"/></a><a href="https://github.com/frontenedaditi"><img src="https://avatars.githubusercontent.com/u/161711740?v=4" width="64" height="64" alt="@frontenedaditi" title="@frontenedaditi" style="border-radius:50%;margin:6px;"/></a>

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
