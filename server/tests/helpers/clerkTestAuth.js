import jwt from "jsonwebtoken";

export function createClerkTestToken({ clerkUserId, email }) {
  return jwt.sign(
    { sub: clerkUserId, email },
    process.env.JWT_SECRET || "test_jwt_secret",
    { expiresIn: "1h" },
  );
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
