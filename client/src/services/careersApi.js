import apiClient from "./apiClient";

/**
 * Submit a public careers application with resume upload (Issue #1790).
 *
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} payload.email
 * @param {string} payload.jobId
 * @param {string} [payload.portfolio]
 * @param {string} [payload.coverLetter]
 * @param {File} payload.resumeFile
 */
export async function submitCareerApplication({
  name,
  email,
  jobId,
  portfolio,
  coverLetter,
  resumeFile,
}) {
  const formData = new FormData();
  formData.append("name", name.trim());
  formData.append("email", email.trim());
  formData.append("jobId", jobId);

  if (portfolio?.trim()) {
    formData.append("portfolio", portfolio.trim());
  }
  if (coverLetter?.trim()) {
    formData.append("coverLetter", coverLetter.trim());
  }

  formData.append("resume", resumeFile);

  return apiClient.post("/api/careers/applications", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 60000,
  });
}

/**
 * Retrieve careers applications for administrative review.
 * @param {object} [params]
 * @param {string} [params.status]
 * @param {string} [params.jobId]
 */
export async function getCareerApplications(params) {
  return apiClient.get("/api/careers/admin/applications", { params });
}

/**
 * Update the status and admin notes for a career application.
 * @param {string} id - The application ID.
 * @param {object} payload
 * @param {string} payload.status - The target status transition.
 * @param {string} payload.adminNotes - Assessment internal notes.
 */
export async function updateCareerApplicationStatus(
  id,
  { status, adminNotes },
) {
  return apiClient.patch(`/api/careers/admin/applications/${id}/status`, {
    status,
    adminNotes,
  });
}

export default {
  submitCareerApplication,
  getCareerApplications,
  updateCareerApplicationStatus,
};
