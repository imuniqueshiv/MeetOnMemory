# Auth & CSRF Regression Checklist

Manual checks for production authentication and CSRF behavior.
Automated coverage lives in:

- `server/tests/authCsrfRegression.test.js`
- `server/tests/csrfErrors.test.js`
- `client/src/services/__tests__/csrfService.test.js`
- `client/src/services/__tests__/apiClient.test.js`
- `client/src/context/__tests__/AppContext.session.test.jsx`
- `client/src/components/__tests__/ProtectedRoute.test.jsx`

## Browsers

- [ ] Chrome
- [ ] Firefox
- [ ] Edge
- [ ] Brave
- [ ] Safari
- [ ] Android Chrome
- [ ] Incognito / Private window

## Session flows

- [ ] Register creates a session and lands in the app without a hard refresh
- [ ] Login restores the session without a hard refresh
- [ ] Logout clears the session and blocks protected routes
- [ ] Hard refresh keeps the user signed in
- [ ] Opening a second tab stays signed in
- [ ] Expired/invalid session redirects to login cleanly

## CSRF & cookies

- [ ] Authenticated POST/PATCH/PUT/DELETE requests succeed with a valid CSRF token
- [ ] Mutating requests fail cleanly when the CSRF token is missing/stale, then succeed after refresh
- [ ] Auth cookie is `HttpOnly`
- [ ] Production cookie uses `Secure` + appropriate `SameSite`
- [ ] Cookies persist across refresh on the deployed HTTPS origin

## Protected features

- [ ] Organization create / join
- [ ] Membership requests
- [ ] AI Search
- [ ] Meeting upload
- [ ] Policy upload
- [ ] Other authenticated write endpoints used in the release

## Notes

Record browser, date, and any failures below:

```
Browser:
Date:
Result:
Notes:
```
