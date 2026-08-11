import { useState, useEffect, useRef } from "react";

export default function useLiveChat() {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I am your MeetOnMemory virtual assistant. How can I help you today?",
      time: "Just now",
    },
  ]);
  const [botTyping, setBotTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, botTyping]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    const timeStr = new Date().toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    // Append User Message
    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: userText, time: timeStr },
    ]);
    setChatInput("");
    setBotTyping(true);

    // Bot Auto-reply logic
    setTimeout(() => {
      let replyText =
        "Thank you for your message. Our team will read this and get back to you shortly. Feel free to submit a formal support ticket using the contact form.";
      const query = userText.toLowerCase();

      if (
        query.includes("hello") ||
        query.includes("hi ") ||
        query.includes("hey")
      ) {
        replyText =
          "Hello! Hope you are having a great day. How can I assist you with MeetOnMemory?";
      } else if (
        query.includes("pricing") ||
        query.includes("cost") ||
        query.includes("plan") ||
        query.includes("credit")
      ) {
        replyText =
          "We offer free and premium tiers. You can view rates and purchase AI credits under the Settings > Billing panel inside your account dashboard.";
      } else if (
        query.includes("gemini") ||
        query.includes("ai model") ||
        query.includes("training")
      ) {
        replyText =
          "We use secure Google Gemini APIs under a zero-retention developer policy. Your meeting transcripts and organizational data are never used for model training.";
      } else if (
        query.includes("delete") ||
        query.includes("retention") ||
        query.includes("purge")
      ) {
        replyText =
          "You can permanently delete transcripts or workspaces at any time. Deleting files purges their data from MongoDB storage and deletes vector records from Pinecone.";
      } else if (
        query.includes("error") ||
        query.includes("fail") ||
        query.includes("bug")
      ) {
        replyText =
          "I'm sorry to hear that! Please file a support ticket using our form, or write directly to support@meetonmemory.com so we can investigate the server logs.";
      }

      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: replyText, time: timeStr },
      ]);
      setBotTyping(false);
    }, 1000);
  };

  return {
    chatInput,
    setChatInput,
    chatMessages,
    botTyping,
    chatEndRef,
    handleSendMessage,
  };
}
