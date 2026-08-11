import helmet from "helmet";

// server/config/security.js
//
// Issue #979 — the app shipped no security response headers at all.
//
//     $ grep -rn "helmet\|X-Frame-Options\|Content-Security-Policy" server/config server/server.js
//     (no matches)
//
// `configureExpress` applied cors, body parsers, cookie-parser, CSRF and the
// rate limiter — and nothing else. Every response, including the SPA and every
// JSON payload, was served without `nosniff`, without frame protection, without
// a CSP, without HSTS, and with `X-Powered-By: Express` advertising the stack.
//
// The frame-protection gap is the sharpest one: **the whole authenticated app
// could be embedded by any origin**, which is a live clickjacking vector against
// state-changing UI and is *not* mitigated by CSRF tokens, because the victim
// performs the click themselves inside the frame.
//
// CSP matters here specifically: this repo has an ongoing series of
// HTML-injection hardening issues (#833 digest preview HTML, #804 digest HTML +
// iframe sandboxing, #613 transcript viewer XSS). A CSP is the layer that
// contains the impact of the next one that slips through.

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy directives.
 *
 * Deliberately explicit rather than relying on helmet's defaults, because a
 * few of them have to be loosened for this app and it should be obvious *which*
 * and *why* rather than being implied by silence.
 */
const buildCspDirectives = () => ({
  defaultSrc: ["'self'"],

  // Vite injects inline styles, and Tailwind's runtime utilities set style
  // attributes. 'unsafe-inline' for styles is the standard trade-off; it is far
  // less dangerous than the script equivalent.
  styleSrc: ["'self'", "'unsafe-inline'", "https:"],

  // No 'unsafe-inline' / 'unsafe-eval' for scripts. If the SPA build turns out
  // to need one, that should be a deliberate, reviewed change rather than
  // something the policy grants pre-emptively.
  scriptSrc: ["'self'"],

  // Meeting attachments, organization logos and avatars come from external
  // storage; `data:` covers inline chart/QR rendering.
  imgSrc: ["'self'", "data:", "blob:", "https:"],

  fontSrc: ["'self'", "data:", "https:"],

  // The SPA talks to this API cross-origin in split-origin deployments, and
  // Socket.IO needs ws/wss for the realtime features.
  connectSrc: ["'self'", "https:", "wss:", "ws:"],

  // Audio/video playback of uploaded recordings, plus blob: for in-browser
  // recording previews.
  mediaSrc: ["'self'", "blob:", "https:"],

  // The modern equivalent of X-Frame-Options: nothing may embed us.
  frameAncestors: ["'none'"],

  // Nothing should be loading Flash/Java-era plugins.
  objectSrc: ["'none'"],

  baseUri: ["'self'"],
  formAction: ["'self'"],
});

/**
 * Builds the helmet middleware.
 *
 * CSP defaults to **report-only** so it can be deployed without any risk of
 * breaking the SPA, and switched to enforcing with a single env var once the
 * violation reports come back clean. Shipping an enforcing CSP blind is how CSP
 * rollouts get reverted and never tried again.
 *
 * @param {object} [options]
 * @param {boolean} [options.enforceCsp]
 * @param {boolean} [options.enableHsts]
 * @returns {import("express").RequestHandler}
 */
export const buildSecurityMiddleware = ({
  enforceCsp = process.env.CSP_ENFORCE === "true",
  enableHsts = isProduction(),
} = {}) =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectives(),
      reportOnly: !enforceCsp,
    },

    // Prevents MIME-sniffing a JSON or user-uploaded response into an
    // executable type.
    xContentTypeOptions: true,

    // Belt-and-braces alongside CSP frame-ancestors, for older browsers.
    frameguard: { action: "deny" },

    // Full URLs — including paths carrying meeting and organization IDs — used
    // to leak to third parties in the Referer header.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },

    // HSTS only in production: sending it from a local HTTP dev server pins the
    // browser to https://localhost for a year, which is a miserable thing to
    // debug.
    hsts: enableHsts
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,

    // COEP would break the cross-origin images and media the app legitimately
    // loads (attachments, avatars, recordings), so it stays off deliberately.
    crossOriginEmbedderPolicy: false,

    // `same-origin` would break split-origin deployments where the SPA is
    // served from a different host than this API.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

/**
 * Applies security headers to an Express app.
 *
 * @param {import("express").Express} app
 * @param {object} [options] forwarded to buildSecurityMiddleware
 */
export const configureSecurity = (app, options = {}) => {
  // Express advertises itself on every response; there is no reason to tell an
  // attacker which stack to look up CVEs for.
  app.disable("x-powered-by");

  app.use(buildSecurityMiddleware(options));
};

export default configureSecurity;
