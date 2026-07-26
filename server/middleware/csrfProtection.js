import csrf from "csurf";
import { sendCsrfInvalid } from "../utils/csrfErrors.js";

const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  },
});

export const csrfProtectionMiddleware = csrfProtection;

export const csrfErrorHandler = (err, req, res, next) => {
  if (err && err.code === "EBADCSRFTOKEN") {
    return sendCsrfInvalid(res);
  }
  return next(err);
};

export const csrfTokenProvider = csrfProtection;
