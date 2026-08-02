const PENDING_PIN_KEY = "meetonmemory-pending-assistant-pin";

/**
 * Store a pending pin and navigate to the AI Assistant.
 * AiAssistant will apply it to the active (or newly created) session.
 */
export function askAssistantAbout(navigate, { type, refId, title }) {
  if (!type || !refId) return;
  try {
    sessionStorage.setItem(
      PENDING_PIN_KEY,
      JSON.stringify({
        type,
        refId: String(refId),
        title: title || "Pinned resource",
      }),
    );
  } catch {
    // ignore storage errors
  }
  navigate("/assistant");
}

export function consumePendingAssistantPin() {
  try {
    const raw = sessionStorage.getItem(PENDING_PIN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_PIN_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export { PENDING_PIN_KEY };
