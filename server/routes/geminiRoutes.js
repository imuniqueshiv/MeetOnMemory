import express from "express";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/insights", async (req, res) => {
  try {
    const { summary } = req.body;

    const prompt = `
You are an AI analyst. Based on these data points:
${JSON.stringify(summary, null, 2)}

Generate a professional 3-paragraph analytics summary highlighting:
1️⃣ General trends in meetings and policies
2️⃣ Key insights and growth or decline
3️⃣ Recommendations or next steps

Use formal, data-driven tone.
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No AI insights generated.";
    res.status(200).json({ success: true, insight: text });
  } catch (error) {
    console.error("Gemini insights error:", error.message);
    res.status(500).json({ success: false, message: "AI insight generation failed." });
  }
});

export default router;
