import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAssistant from "../context/useAssistant";
import { consumePendingAssistantPin } from "../utils/askAssistant.js";

/**
 * Legacy /assistant route — opens the floating workspace and leaves the page.
 */
const AiAssistant = () => {
  const navigate = useNavigate();
  const { openAssistant, ensureSessionAndPin } = useAssistant();

  useEffect(() => {
    openAssistant();
    const pending = consumePendingAssistantPin();
    if (pending) {
      ensureSessionAndPin(pending).catch((err) => {
        console.error(err);
      });
    }
    navigate("/meetings", { replace: true });
  }, [openAssistant, ensureSessionAndPin, navigate]);

  return null;
};

export default AiAssistant;
