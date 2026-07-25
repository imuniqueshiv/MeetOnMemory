import { useState } from "react";

export default function useContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    org: "",
    subject: "",
    department: "support",
    message: "",
  });
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      const ticketId = "MOM-" + Math.floor(100000 + Math.random() * 900000);
      setSubmittedTicket({
        id: ticketId,
        name: formData.name,
        email: formData.email,
        department: formData.department,
        subject: formData.subject,
        date: new Date().toLocaleString(),
        status: "Open / Queued",
        sla:
          formData.department === "sales"
            ? "Within 4 hours"
            : "Within 12 hours",
      });
      setSubmitting(false);
      // Clear form
      setFormData({
        name: "",
        email: "",
        org: "",
        subject: "",
        department: "support",
        message: "",
      });
    }, 1500);
  };

  return {
    formData,
    setFormData,
    submittedTicket,
    setSubmittedTicket,
    submitting,
    handleFormSubmit,
  };
}
