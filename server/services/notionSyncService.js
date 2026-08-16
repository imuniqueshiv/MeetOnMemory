import axios from "axios";
import CryptoJS from "crypto-js";

// Rate Limit Queue Implementation
class RateLimitQueue {
  constructor(requestsPerSecond = 3) {
    this.queue = [];
    this.isProcessing = false;
    this.delayMs = 1000 / requestsPerSecond;
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      try {
        const result = await task();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      await new Promise((res) => setTimeout(res, this.delayMs));
    }

    this.isProcessing = false;
  }
}

const notionQueue = new RateLimitQueue(3);

const decryptToken = (encryptedToken) => {
  const bytes = CryptoJS.AES.decrypt(
    encryptedToken,
    process.env.NOTION_ENCRYPTION_SECRET || "default_secret"
  );
  return bytes.toString(CryptoJS.enc.Utf8);
};

export const syncToNotionDatabase = async (config, blocks, properties) => {
  const token = decryptToken(config.encryptedAccessToken);
  const databaseId = config.targetDatabaseId;

  if (!databaseId) {
    throw new Error("No target database configured for this organization.");
  }

  const payload = {
    parent: {
      database_id: databaseId,
    },
    properties,
    children: blocks,
  };

  const task = async () => {
    const response = await axios.post("https://api.notion.com/v1/pages", payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
    });
    return response.data;
  };

  return notionQueue.enqueue(task);
};
