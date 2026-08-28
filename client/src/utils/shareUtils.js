export const generateSharePayload = (badge) => {
  const title = `I just earned the ${badge.name} badge on MeetOnMemory!`;
  const text = `Check out my new ${badge.tier} tier achievement: ${badge.description}. I'm leveling up my meeting hygiene!`;
  const url = `${window.location.origin}/badges#badge-${badge.id}`;

  return { title, text, url };
};

export const handleShare = async (badge) => {
  const payload = generateSharePayload(badge);
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return true;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error sharing", error);
      }
      return false;
    }
  } else {
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(
        `${payload.title}\n${payload.text}\n${payload.url}`,
      );
      return true;
    } catch (error) {
      console.error("Clipboard copy failed", error);
      return false;
    }
  }
};
