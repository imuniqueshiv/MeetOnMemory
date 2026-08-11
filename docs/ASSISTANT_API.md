# Assistant API Documentation

The Assistant API provides conversational retrieval-augmented generation (RAG) capabilities over organization meetings, policies, and knowledge items using Google Gemini and Pinecone vector search.

---

## Authentication & Base Path

All Assistant API endpoints require authentication via Clerk (`userAuth` middleware) and organization membership.

- **Base Path**: `/api/assistant`
- **Headers**: Standard Clerk authentication tokens/cookies.

---

## API Endpoints

### 1. Create a Chat Session

Creates a new RAG chat session scoped to the authenticated user and their organization.

- **Method**: `POST`
- **Endpoint**: `/api/assistant/sessions`
- **Request Body**: None (or empty JSON `{}`)
- **Response**: `201 Created`
  ```json
  {
    "_id": "66ae5b10f01a2b3c4d5e6f7a",
    "organizationId": "66ae5a00f01a2b3c4d5e6f70",
    "userId": "66ae5a05f01a2b3c4d5e6f71",
    "title": "New Chat",
    "messages": [],
    "createdAt": "2026-08-04T12:00:00.000Z",
    "updatedAt": "2026-08-04T12:00:00.000Z"
  }
  ```

---

### 2. List Chat Sessions

Retrieves all chat sessions for the authenticated user, sorted by most recently updated.

- **Method**: `GET`
- **Endpoint**: `/api/assistant/sessions`
- **Response**: `200 OK`
  ```json
  [
    {
      "_id": "66ae5b10f01a2b3c4d5e6f7a",
      "title": "Q3 Budget Discussion",
      "pinnedContext": {
        "type": "meeting",
        "refId": "66ae5900f01a2b3c4d5e6f50",
        "title": "Q3 Planning Meeting"
      },
      "createdAt": "2026-08-04T12:00:00.000Z",
      "updatedAt": "2026-08-04T12:05:00.000Z"
    }
  ]
  ```

---

### 3. Get a Specific Chat Session

Fetches a single chat session including full message history and pinned context.

- **Method**: `GET`
- **Endpoint**: `/api/assistant/sessions/:id`
- **Response**: `200 OK`
  ```json
  {
    "_id": "66ae5b10f01a2b3c4d5e6f7a",
    "organizationId": "66ae5a00f01a2b3c4d5e6f70",
    "userId": "66ae5a05f01a2b3c4d5e6f71",
    "title": "Q3 Budget Discussion",
    "pinnedContext": {
      "type": "meeting",
      "refId": "66ae5900f01a2b3c4d5e6f50",
      "title": "Q3 Planning Meeting"
    },
    "messages": [
      {
        "_id": "66ae5b20f01a2b3c4d5e6f7b",
        "role": "user",
        "content": "What decisions were made about recruitment?",
        "sources": []
      },
      {
        "_id": "66ae5b22f01a2b3c4d5e6f7c",
        "role": "assistant",
        "content": "Based on [Source 1], the team decided to hire 2 senior frontend engineers.",
        "sources": [
          {
            "refType": "meeting",
            "refId": "66ae5900f01a2b3c4d5e6f50",
            "title": "Q3 Planning Meeting",
            "snippet": "Decided to hire 2 senior frontend engineers by end of August."
          }
        ]
      }
    ]
  }
  ```
- **Error Response**: `404 Not Found`
  ```json
  {
    "error": "Session not found"
  }
  ```

---

### 4. Delete a Chat Session

Deletes a specific chat session belonging to the user.

- **Method**: `DELETE`
- **Endpoint**: `/api/assistant/sessions/:id`
- **Response**: `204 No Content`

---

### 5. Pin / Replace Pinned Context

Pins a resource (`meeting`, `policy`, or `knowledge`) to the session to prioritize its context during retrieval.

- **Method**: `PUT`
- **Endpoint**: `/api/assistant/sessions/:id/pinned-context`
- **Request Body**:
  ```json
  {
    "type": "meeting",
    "refId": "66ae5900f01a2b3c4d5e6f50",
    "title": "Q3 Planning Meeting"
  }
  ```
- **Validation**:
  - `type`: Must be one of `"meeting"`, `"policy"`, or `"knowledge"`.
  - `refId`: Must be a valid MongoDB ObjectId accessible within user's organization.
- **Response**: `200 OK`
  ```json
  {
    "pinnedContext": {
      "type": "meeting",
      "refId": "66ae5900f01a2b3c4d5e6f50",
      "title": "Q3 Planning Meeting"
    },
    "sessionId": "66ae5b10f01a2b3c4d5e6f7a"
  }
  ```

---

### 6. Remove Pinned Context

Clears any pinned context associated with the session.

- **Method**: `DELETE`
- **Endpoint**: `/api/assistant/sessions/:id/pinned-context`
- **Response**: `200 OK`
  ```json
  {
    "pinnedContext": undefined,
    "sessionId": "66ae5b10f01a2b3c4d5e6f7a"
  }
  ```

---

### 7. Send Message & Stream Response

Submits a user prompt for asynchronous processing and streaming via Socket.IO.

- **Method**: `POST`
- **Endpoint**: `/api/assistant/sessions/:id/message`
- **Rate Limit**: 10 requests per minute per user.
- **Request Body**:
  ```json
  {
    "content": "What is our policy regarding remote work equipment?"
  }
  ```
- **Response**: `202 Accepted`
  ```json
  {
    "status": "Processing"
  }
  ```

---

## Real-Time Socket.IO Streaming Events

When a message is sent to `/api/assistant/sessions/:id/message`, the backend streams the AI model response back over Socket.IO.

### Client Socket Subscriptions

Clients should connect to Socket.IO and listen for the following events:

1. **`assistant_message_chunk`**: Emitted sequentially as text chunks arrive from Gemini stream.

   ```json
   {
     "sessionId": "66ae5b10f01a2b3c4d5e6f7a",
     "chunk": "Based on our remote work policy..."
   }
   ```

2. **`assistant_message_done`**: Emitted when the full assistant response and source citations are persisted.

   ```json
   {
     "sessionId": "66ae5b10f01a2b3c4d5e6f7a",
     "message": {
       "role": "assistant",
       "content": "Based on our remote work policy...",
       "sources": [
         {
           "refType": "policy",
           "refId": "66ae5800f01a2b3c4d5e6f40",
           "title": "Remote Work Policy",
           "snippet": "Employees receive a $500 home office hardware stipend."
         }
       ]
     },
     "title": "Remote Work Stipend"
   }
   ```

3. **`assistant_error`**: Emitted if processing encounters an error.
   ```json
   {
     "sessionId": "66ae5b10f01a2b3c4d5e6f7a",
     "error": "Failed to process message."
   }
   ```
