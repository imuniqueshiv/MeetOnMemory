import { useContext } from "react";
import AssistantContext from "./AssistantContext.jsx";

const useAssistant = () => {
  const ctx = useContext(AssistantContext);
  if (!ctx) {
    throw new Error("useAssistant must be used within AssistantProvider");
  }
  return ctx;
};

export default useAssistant;
