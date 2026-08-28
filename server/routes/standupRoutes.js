import express from "express";
import userAuth from "../middleware/userAuth.js";
import { getStandupReport } from "../controllers/standupController.js";

const router = express.Router();

router.use(userAuth);

router.get("/report", getStandupReport);

export default router;
