# Request Correlation IDs

MeetOnMemory assigns a correlation ID to every Express request. This reference
connects browser error reports with structured backend logs without exposing
stack traces or sensitive request data.

## Header contract

Clients may send a valid `X-Request-ID` header. Valid IDs:

- Are 1–128 characters long
- Start with an alphanumeric character
- Contain only letters, digits, `.`, `_`, `:`, or `-`
- Do not contain whitespace or control characters

Invalid, missing, or oversized IDs are replaced with a cryptographically secure
UUID. Every response includes the final value in `X-Request-ID`.

## Error response

Global validation, authorization, not-found, CSRF, and unexpected error paths
include the same ID:

```json
{
  "success": false,
  "message": "Internal Server Error",
  "requestId": "7e4de5f1-1234-4567-8901-abcdefabcdef"
}
```

Production 500 responses never include stack traces or internal error messages.

## Logging

The request-scoped logger includes `requestId` in request completion and error
records. Metadata is recursively sanitized. Keys matching authorization,
cookies, passwords, tokens, secrets, API keys, files, and uploads are redacted.

Controllers and services can use:

```js
req.log.info("Meeting updated", { meetingId });
req.log.error("Calendar provider failed", error, { provider: "google" });
```

Do not log entire request bodies, headers, uploaded files, or provider payloads.

## Client display

The Axios error interceptor preserves the full `requestId` in
`error.response.data.requestId`. For unexpected 5xx responses, the user-facing
message includes the first 12 characters:

```text
Server unavailable. Please try again later. Reference: 7e4de5f1-123
```

## Regression coverage

The correlation middleware is registered before parsers, health probes, public
webhooks, CSRF protection, rate limiting, authentication, and application
routes. The response header is therefore available on every Express response.
For JSON responses with an HTTP status of 400 or greater, the middleware also
adds the matching `requestId` when the responding middleware did not include it.

Automated tests cover successful requests, direct 401/403 responses, application
validation, malformed JSON, oversized payloads, CSRF handling, 404 and 500
responses, request-ID validation, concurrent requests, binary redaction, circular
references, oversized metadata, and frontend 5xx references.

Infrastructure changes are limited to establishing request context early,
propagating it through existing error contracts, safely logging it, and exposing
a shortened reference for unexpected frontend errors.
