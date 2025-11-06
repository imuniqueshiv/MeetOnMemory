import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import axios from "axios";
import { createRequire } from "module";
import Policy from "../models/policyModel.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");


dotenv.config();

const UPLOAD_DIR = path.resolve("uploads/policies");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// 🧠 Helper — Call Gemini to summarize and extract keywords
const generatePolicySummary = async (fileName, textContent) => {
  try {
    const prompt = `
You are an AI compliance analyst. Analyze the policy document content below and return a structured JSON like this:
{
  "summary": "2–3 paragraph concise summary describing the document’s purpose, scope, and main clauses.",
  "key_changes": ["List of main changes or revisions."],
  "keywords": ["Short tags describing policy topics"]
}

Policy File Name: ${fileName}

Policy Text Content:
${textContent?.slice(0, 6000)}

Return ONLY valid JSON (no commentary). Use professional, compliance-focused tone.
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(aiText);
  } catch (error) {
    console.error("❌ Gemini summarization failed:", error.message);
    return {
      summary: "AI summary unavailable.",
      key_changes: [],
      keywords: [],
    };
  }
};

// 🟢 Upload & Process Policy
export const uploadPolicy = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded." });

    const fileName = req.file.originalname;
    const fileUrl = path.join(UPLOAD_DIR, req.file.filename);
    const commitMsg = req.body.commitMsg || "";

    // 1️⃣ Extract text from PDF (with fallback to plain text)
    let textContent = "";
    try {
      const pdfBuffer = fs.readFileSync(fileUrl);
      const data = await pdf(pdfBuffer);
      textContent = data.text || "";
    } catch {
      console.warn("⚠️ Failed PDF parse, using raw file read.");
      textContent = fs.readFileSync(fileUrl, "utf8").toString();
    }

    // 2️⃣ Generate AI summary + metadata
    console.log("📡 Calling Gemini for AI summary...");
    const aiData = await generatePolicySummary(fileName, textContent);
    console.log("✅ Gemini summary complete.");

    // 3️⃣ Versioning — update if exists
    const existing = await Policy.findOne({ name: fileName });
    if (existing) {
      existing.previousVersions.push({
        name: existing.name,
        version: existing.version,
        fileUrl: existing.fileUrl,
        commitMsg: existing.commitMsg,
        createdAt: existing.createdAt,
        uploadedBy: existing.uploadedBy,
      });

      const nextVersion = (parseFloat(existing.version) + 0.1).toFixed(1);
      existing.version = nextVersion;
      existing.fileUrl = fileUrl;
      existing.summary = aiData.summary;
      existing.key_changes = aiData.key_changes;
      existing.keywords = aiData.keywords;
      existing.commitMsg = commitMsg;
      existing.lastEditedBy = req.user?._id;
      await existing.save();

      return res.status(200).json({
        success: true,
        message: "✅ Policy updated & summarized by AI",
        policy: existing,
      });
    }

    // 4️⃣ Create new policy
    const policy = await Policy.create({
      name: fileName,
      version: "1.0",
      fileUrl,
      summary: aiData.summary,
      key_changes: aiData.key_changes,
      keywords: aiData.keywords,
      commitMsg,
      uploadedBy: req.user?._id,
      lastEditedBy: req.user?._id,
    });

    res.status(201).json({
      success: true,
      message: "✅ Policy uploaded & analyzed successfully",
      policy,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ success: false, message: "Server error during upload" });
  }
};

// 🟢 Get All Policies
export const getPolicies = async (req, res) => {
  try {
    const policies = await Policy.find()
      .populate("uploadedBy", "name email")
      .populate("lastEditedBy", "name email")
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, policies });
  } catch (error) {
    console.error("❌ Fetch policies error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch policies" });
  }
};

// 🟢 Download Policy File
export const downloadPolicy = async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    if (!policy)
      return res.status(404).json({ success: false, message: "Policy not found" });

    res.download(policy.fileUrl);
  } catch (error) {
    console.error("❌ Download error:", error);
    res.status(500).json({ success: false, message: "Download failed" });
  }
};

// 🗑️ Delete Policy
export const deletePolicy = async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    if (!policy)
      return res.status(404).json({ success: false, message: "Policy not found" });

    // Delete local file if exists
    if (fs.existsSync(policy.fileUrl)) fs.unlinkSync(policy.fileUrl);

    await policy.deleteOne();
    res.status(200).json({ success: true, message: "🗑️ Policy deleted successfully" });
  } catch (error) {
    console.error("❌ Delete policy error:", error);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};
