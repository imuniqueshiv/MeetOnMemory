import { useState, useEffect, useCallback } from "react";
import { meetingQuestionApi } from "../services/meetingQuestionApi";
import { io } from "socket.io-client";
import { createClerkSocketOptions } from "../services/apiClient";

export const useMeetingQA = (meetingId) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await meetingQuestionApi.getQuestions(meetingId);
      if (data.success) {
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (meetingId) {
      fetchQuestions();
    }
  }, [meetingId, fetchQuestions]);

  useEffect(() => {
    if (!meetingId) return;

    let activeSocket;
    let cancelled = false;

    const initSocket = async () => {
      const opts = await createClerkSocketOptions();
      if (cancelled) return;

      activeSocket = io(backendUrl, opts);
      setSocket(activeSocket);

      const handleQuestionAdded = (question) => {
        setQuestions((prev) => {
          if (prev.some((q) => q._id === question._id)) return prev;
          return [...prev, question];
        });
      };

      const handleQuestionUpvoted = ({ questionId, upvotes }) => {
        setQuestions((prev) =>
          prev.map((q) => (q._id === questionId ? { ...q, upvotes } : q)),
        );
      };

      const handleQuestionStatusChanged = ({ questionId, status }) => {
        setQuestions((prev) =>
          prev.map((q) => (q._id === questionId ? { ...q, status } : q)),
        );
      };

      activeSocket.on("qa:question-added", handleQuestionAdded);
      activeSocket.on("qa:question-upvoted", handleQuestionUpvoted);
      activeSocket.on(
        "qa:question-status-changed",
        handleQuestionStatusChanged,
      );

      // We should also join a specific room if needed, but the current implementation in meetingSocket.js
      // just broadcasts to the meetingId room which the user is already part of via "join-meeting" event.
    };

    initSocket();

    return () => {
      cancelled = true;
      if (activeSocket) {
        activeSocket.disconnect();
      }
    };
  }, [meetingId, backendUrl]);

  const submitQuestion = async (text, isAnonymous) => {
    try {
      const { data } = await meetingQuestionApi.submitQuestion(meetingId, {
        text,
        isAnonymous,
      });
      if (data.success && socket) {
        socket.emit("qa:submit-question", {
          roomId: meetingId,
          question: data.question,
        });
        setQuestions((prev) => {
          if (prev.some((q) => q._id === data.question._id)) return prev;
          return [...prev, data.question];
        });
      }
      return data;
    } catch (err) {
      throw new Error(
        err.response?.data?.message || "Failed to submit question",
      );
    }
  };

  const toggleUpvote = async (questionId) => {
    try {
      const { data } = await meetingQuestionApi.toggleUpvote(questionId);
      if (data.success && socket) {
        socket.emit("qa:upvote-question", {
          roomId: meetingId,
          questionId,
          upvotes: data.upvotes,
        });
      }
    } catch (err) {
      console.error(err);
      throw new Error("Failed to upvote");
    }
  };

  const updateStatus = async (questionId, status) => {
    try {
      const { data } = await meetingQuestionApi.updateStatus(
        questionId,
        status,
      );
      if (data.success && socket) {
        socket.emit("qa:status-changed", {
          roomId: meetingId,
          questionId,
          status,
        });
      }
    } catch (err) {
      console.error(err);
      throw new Error("Failed to update status");
    }
  };

  return {
    questions,
    loading,
    error,
    submitQuestion,
    toggleUpvote,
    updateStatus,
  };
};
