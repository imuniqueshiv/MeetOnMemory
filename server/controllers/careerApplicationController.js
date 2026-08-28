import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import CareerApplication from "../models/careerApplicationModel.js";
import { submitCareerApplication } from "../services/careerApplicationService.js";
import { sendSuccess } from "../utils/responseHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createSubmitCareerApplicationHandler = () => {
  return async (req, res, next) => {
    try {
      const result = await submitCareerApplication({
        name: req.body.name,
        email: req.body.email,
        jobId: req.body.jobId,
        portfolio: req.body.portfolio,
        coverLetter: req.body.coverLetter,
        resumeFile: req.file,
      });

      return sendSuccess(
        res,
        { applicationId: result.id },
        "Application submitted successfully.",
        201,
      );
    } catch (error) {
      next(error);
    }
  };
};

export const createListApplicationsHandler = () => {
  return async (req, res, next) => {
    try {
      const { status, jobId } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (jobId) filter.jobId = jobId;

      const applications = await CareerApplication.find(filter).sort({
        createdAt: -1,
      });

      return sendSuccess(
        res,
        { data: applications },
        "Applications retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  };
};

export const createUpdateApplicationStatusHandler = () => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;

      const allowedStatuses = [
        "received",
        "pending",
        "reviewing",
        "interview_scheduled",
        "rejected",
        "accepted",
      ];
      if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status option.",
        });
      }

      const updateData = {};
      if (status) updateData.status = status;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      updateData.reviewedAt = new Date();
      updateData.reviewedBy = req.user?._id;

      const application = await CareerApplication.findByIdAndUpdate(
        id,
        updateData,
        { new: true },
      );

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found.",
        });
      }

      return sendSuccess(
        res,
        { data: application },
        "Application status updated successfully.",
      );
    } catch (error) {
      next(error);
    }
  };
};

export const createDownloadResumeHandler = () => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const application = await CareerApplication.findById(id);

      if (!application || !application.resume) {
        return res.status(404).json({
          success: false,
          message: "Resume not found.",
        });
      }

      const careersDir = path.join(__dirname, "..", "uploads", "careers");
      const safePath = path.resolve(careersDir, application.resume.storedName);

      if (!safePath.startsWith(careersDir)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden file path.",
        });
      }

      try {
        await fs.access(safePath);
      } catch {
        return res.status(404).json({
          success: false,
          message: "Resume file does not exist on disk.",
        });
      }

      res.setHeader("Content-Type", application.resume.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(application.resume.originalName)}"`,
      );

      return res.sendFile(safePath);
    } catch (error) {
      next(error);
    }
  };
};

export const submitApplication = createSubmitCareerApplicationHandler();
export const listApplications = createListApplicationsHandler();
export const updateApplicationStatus = createUpdateApplicationStatusHandler();
export const downloadResume = createDownloadResumeHandler();

export default {
  submitApplication,
  listApplications,
  updateApplicationStatus,
  downloadResume,
};
