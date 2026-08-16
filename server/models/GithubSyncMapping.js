import mongoose from "mongoose";
import CryptoJS from "crypto-js";

const githubSyncSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting", required: true },
  githubIssueNumber: { type: Number, required: true },
  githubRepoFullName: { type: String, required: true }, // e.g. "org/repo"
  encryptedAccessToken: { type: String, required: true },
  status: { type: String, enum: ["open", "closed", "synced"], default: "synced" }
}, { timestamps: true });

// Encryption helpers
const SECRET_KEY = process.env.ENCRYPTION_KEY || "default_secret_key_123";

githubSyncSchema.methods.encryptToken = function (token) {
  this.encryptedAccessToken = CryptoJS.AES.encrypt(token, SECRET_KEY).toString();
};

githubSyncSchema.methods.decryptToken = function () {
  const bytes = CryptoJS.AES.decrypt(this.encryptedAccessToken, SECRET_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

export default mongoose.models.GithubSyncMapping || mongoose.model("GithubSyncMapping", githubSyncSchema);
