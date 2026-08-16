import CryptoJS from "crypto-js";

const SECRET_KEY = process.env.ENCRYPTION_KEY || "default_secret_key_123";

export const githubAuthGuard = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing GitHub token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    req.githubToken = token;
    req.encryptedGithubToken = CryptoJS.AES.encrypt(token, SECRET_KEY).toString();
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Token encryption failed" });
  }
};
