import { allowedOrigins } from "../config/corsOptions.js";

export function originValidationMiddleware(req, res, next) {
  const origin = req.headers?.origin;

  // Requests without Origin header are generally server-to-server or same-origin traffic
  // and are explicitly trusted by the existing authentication/CSRF stack.
  if (!origin) {
    return next();
  }

  if (origin === "null") {
    console.warn("Blocked by origin validation: null origin", {
      method: req.method,
      url: req.originalUrl || req.url,
      requestId: req.requestId,
    });
    return res.status(403).json({
      success: false,
      message: "Untrusted request origin.",
      requestId: req.requestId,
    });
  }

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  console.warn("Blocked by origin validation: untrusted origin", {
    origin,
    method: req.method,
    url: req.originalUrl || req.url,
    requestId: req.requestId,
  });

  return res.status(403).json({
    success: false,
    message: "Untrusted request origin.",
    requestId: req.requestId,
  });
}
