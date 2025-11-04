// ================================
// searchRoutes.js
// AI-Powered Semantic Search Routes
// ================================

import express from "express";
import { semanticSearch } from "../controllers/searchController.js";
import userAuth from "../middleware/userAuth.js";

const router = express.Router();

// 🔹 POST /api/search
// Protected route — requires login (JWT cookie)
// Expects: { query: "attendance policy" }
router.post("/", userAuth, semanticSearch);

export default router;
