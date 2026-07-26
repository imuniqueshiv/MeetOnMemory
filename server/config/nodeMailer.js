import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

const isMock =
  !process.env.SMTP_USER ||
  process.env.SMTP_USER === "your_email" ||
  process.env.SMTP_USER.trim() === "" ||
  !process.env.SMTP_PASS ||
  process.env.SMTP_PASS === "your_password" ||
  process.env.SMTP_PASS.trim() === "";

let _realTransporter = null;

const mockTransporter = {
  verify: (callback) => {
    if (typeof callback === "function") {
      callback(null, true);
      return;
    }
    return Promise.resolve(true);
  },
  sendMail: async (options) => {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMTP credentials are not configured. Email cannot be sent in production.",
      );
    }
    console.log("=========================================");
    console.log("✉️ MOCK EMAIL SENT");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log("Content:");
    console.log(options.text || options.html);
    console.log("=========================================");
    return { messageId: "mock-id-" + Date.now() };
  },
};

function getTransporter() {
  if (isMock) {
    return mockTransporter;
  }

  if (!_realTransporter) {
    let host = process.env.SMTP_HOST;
    if (!host) {
      if (
        process.env.SMTP_USER &&
        process.env.SMTP_USER.endsWith("@gmail.com")
      ) {
        host = "smtp.gmail.com";
      } else {
        host = "smtp-relay.brevo.com";
      }
    }
    let port = parseInt(process.env.SMTP_PORT || "587", 10);
    if (isNaN(port)) {
      console.warn(
        `⚠️ Invalid SMTP_PORT specified: "${process.env.SMTP_PORT}". Defaulting to 587.`,
      );
      port = 587;
    }
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    _realTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 5000, // 5 seconds connection timeout
      greetingTimeout: 5000, // 5 seconds greeting timeout
      socketTimeout: 10000, // 10 seconds socket idle timeout
    });
  }
  return _realTransporter;
}

// Log warning in production if mock mode is used
if (isMock && process.env.NODE_ENV === "production") {
  console.warn(
    "⚠️ CRITICAL WARNING: SMTP is running in mock mode in PRODUCTION! Real emails will NOT be sent.",
  );
} else if (isMock && process.env.NODE_ENV !== "test") {
  console.log("ℹ️ SMTP is in mock mode (console logging for emails)");
}

const transporter = {
  verify: (callback) => {
    const currentTransporter = getTransporter();
    if (typeof callback === "function") {
      return currentTransporter.verify(callback);
    }
    if (typeof currentTransporter.verify === "function") {
      return currentTransporter.verify();
    }
    return Promise.resolve(true);
  },
  sendMail: async (options) => {
    const currentTransporter = getTransporter();
    try {
      return await currentTransporter.sendMail(options);
    } catch (error) {
      if (!isMock) {
        console.error("❌ SMTP sendMail failed:", error);
      }
      throw error;
    }
  },
};

export default transporter;
