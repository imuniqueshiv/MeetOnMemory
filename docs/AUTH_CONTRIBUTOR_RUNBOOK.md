# 🔐 Authentication Contributor Runbook

This document is the official guide for contributors to set up, run, and test the **Clerk authentication system** locally.

---

## 📚 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Environment Variables](#-environment-variables)
3. [Local Clerk Setup Guide](#-local-clerk-setup-guide)
4. [User Synchronization (`sync-clerk-user`)](#-user-synchronization-sync-clerk-user)
5. [Testing Auth Flows Locally](#-testing-auth-flows-locally)

---

## 🏗️ Architecture Overview

MeetOnMemory uses **Clerk** as the sole identity provider.

- **Identity & Session Verification**: Managed entirely by Clerk via Bearer tokens sent in the `Authorization` header of API requests.
- **Authorization & RBAC**: Managed internally in MongoDB. The backend resolves the Clerk user (via their Clerk `sub` ID) to a MongoDB `User` document, which holds their role (`User.role`) and organization association (`User.organization`).
- **Legacy Auth**: Traditional email/password login, cookie-based session verification, and csurf CSRF protection have been fully retired and removed. Do not reintroduce them.

---

## 🔑 Environment Variables

To run the application locally, you must configure the following Clerk keys in your `.env` files.

### Client (`client/.env`)

| Variable                     | Description                                            | Example / Value |
| :--------------------------- | :----------------------------------------------------- | :-------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key (identifies your Clerk instance) | `pk_test_...`   |

### Server (`server/.env`)

| Variable           | Description                                                                           | Example / Value               |
| :----------------- | :------------------------------------------------------------------------------------ | :---------------------------- |
| `AUTH_PROVIDER`    | Defines the identity provider for the server                                          | `clerk`                       |
| `CLERK_SECRET_KEY` | Clerk Secret Key (used to call Clerk API/verify tokens)                               | `sk_test_...`                 |
| `JWT_SECRET`       | Secret key used to sign secondary tokens (Slack OAuth state, exports) and test tokens | `your_development_jwt_secret` |

---

## 🚀 Local Clerk Setup Guide

Follow these steps to set up a free Clerk instance for local development:

1. **Sign Up**: Go to [Clerk.com](https://clerk.com) and create a free account.
2. **Create Application**: In the Clerk dashboard, click **Add Application**.
   - Name it `MeetOnMemory Dev` or similar.
   - Under **Select authentication providers**, check **Email** and **Password** (default). Click **Create Application**.
3. **Retrieve Keys**: Once the application is created, copy the **Publishable Key** and **Secret Key** from the home screen.
4. **Configure Client**:
   - Create or open `client/.env`.
   - Set `VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_copied_key`.
5. **Configure Server**:
   - Create or open `server/.env`.
   - Set `AUTH_PROVIDER=clerk`.
   - Set `CLERK_SECRET_KEY=sk_test_your_copied_secret`.
6. **JWT Templates (Optional)**: If you need custom session claims, configure a custom JWT template in the Clerk Dashboard under **JWT Templates**, but the default template is sufficient for normal local development.

---

## 🔄 User Synchronization (`sync-clerk-user`)

When a user signs in or registers via Clerk, the client receives a Clerk session token. It then calls the backend `/sync-clerk-user` endpoint:

- **Route**: `POST /api/auth/sync-clerk-user`
- **Auth**: Protected by the `userAuth` middleware, which expects the Clerk token as a `Bearer` token in the `Authorization` header.
- **Workflow**:
  1. The `userAuth` middleware parses and verifies the Clerk token.
  2. If a MongoDB user with matching `clerkUserId` (Clerk's `sub` claim) is found, it loads that user document into `req.user`.
  3. If no user is found, the middleware automatically triggers `provisionOrLinkClerkUser` inside `authLinkingService.js`.
  4. The service attempts to find an existing MongoDB user by matching the primary email address. If found, it links the `clerkUserId` to the document. Otherwise, it creates a new MongoDB user document with a secure, random dummy password.

---

## 🧪 Testing Auth Flows Locally

For automated unit and integration tests, we mock external Clerk network requests using a JWT test fallback:

- **Test Auth Setup**:
  In tests, we set the environment variable `CLERK_TEST_AUTH=jwt`.
- **JWT Verification**:
  When `CLERK_TEST_AUTH=jwt` is enabled, the backend resolves Clerk tokens by validating them using the local `JWT_SECRET` key.
- **Helper Methods**:
  Use `createClerkTestToken({ clerkUserId, email, name })` inside `server/tests/helpers/clerkTestAuth.js` to sign mock Clerk tokens for integration tests.

Example usage in a test:

```javascript
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";

const token = createClerkTestToken({
  clerkUserId: "user_test_123",
  email: "test@example.com",
});

const response = await request(app)
  .get("/api/meetings/all")
  .set("Authorization", authHeader(token));
```
