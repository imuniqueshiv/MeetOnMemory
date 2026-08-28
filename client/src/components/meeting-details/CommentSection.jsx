import React, { useState, useEffect, useContext, useRef } from "react";
import AppContent from "../../context/AppContent";
import { io } from "socket.io-client";
import {
  createComment,
  getCommentsByMeeting,
  updateComment,
  deleteComment,
  toggleReaction,
} from "../../api/commentApi";
import { organizationApi } from "../../services/organizationApi";
import { createClerkSocketOptions } from "../../services/apiClient.js";
import { toast } from "react-toastify";
import MentionPicker from "../mentions/MentionPicker.jsx";
import {
  extractMentionQuery,
  insertMention,
  renderMentions,
} from "../../utils/mentionUtils.jsx";

const CommentSection = ({ meetingId }) => {
  const { userData, backendUrl } = useContext(AppContent) || {};
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");

  const [orgMembers, setOrgMembers] = useState([]);
  const [activeMention, setActiveMention] = useState({
    field: null, // "new" | "reply" | "edit"
    query: "",
  });

  const newCommentRef = useRef(null);
  const replyRef = useRef(null);
  const editRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const res = await organizationApi.getMembers();
        const data = res?.data?.data || res?.data || [];
        setOrgMembers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load org members for mentions:", err);
      }
    };
    loadMembers();
  }, []);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await getCommentsByMeeting(meetingId);
        setComments(data || []);
      } catch (error) {
        console.error("Failed to fetch comments", error);
        toast.error("Failed to load comments. Please try again.");
      }
    };
    fetchComments();

    let cancelled = false;

    (async () => {
      const opts = await createClerkSocketOptions({
        transports: ["websocket"],
      });
      if (cancelled) return;

      socketRef.current = io(backendUrl, opts);

      socketRef.current.on("connect", () => {
        socketRef.current.emit("join-meeting", {
          roomId: meetingId,
          userInfo: { name: userData?.name },
        });
      });

      socketRef.current.on("comment:new", (newComment) => {
        setComments((prev) => [newComment, ...prev]);
      });

      socketRef.current.on("comment:update", (updatedComment) => {
        setComments((prev) =>
          prev.map((c) => (c._id === updatedComment._id ? updatedComment : c)),
        );
      });

      socketRef.current.on("comment:delete", ({ id }) => {
        setComments((prev) => prev.filter((c) => c._id !== id));
      });

      socketRef.current.on("comment:reaction", (updatedComment) => {
        setComments((prev) =>
          prev.map((c) => (c._id === updatedComment._id ? updatedComment : c)),
        );
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [meetingId, backendUrl, userData]);

  const handleInputChange = (field, text, cursorPosition) => {
    if (field === "new") setNewComment(text);
    if (field === "reply") setReplyText(text);
    if (field === "edit") setEditText(text);

    const mentionData = extractMentionQuery(text, cursorPosition);
    if (mentionData.isMentioning) {
      setActiveMention({ field, query: mentionData.query });
    } else {
      setActiveMention({ field: null, query: "" });
    }
  };

  const handleSelectMember = (member) => {
    if (activeMention.field === "new" && newCommentRef.current) {
      const pos = newCommentRef.current.selectionStart || newComment.length;
      const { newText } = insertMention(newComment, pos, member);
      setNewComment(newText);
    } else if (activeMention.field === "reply" && replyRef.current) {
      const pos = replyRef.current.selectionStart || replyText.length;
      const { newText } = insertMention(replyText, pos, member);
      setReplyText(newText);
    } else if (activeMention.field === "edit" && editRef.current) {
      const pos = editRef.current.selectionStart || editText.length;
      const { newText } = insertMention(editText, pos, member);
      setEditText(newText);
    }
    setActiveMention({ field: null, query: "" });
  };

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast.warning("Please enter a comment before submitting.");
      return;
    }

    try {
      await createComment({
        meetingId,
        body: newComment,
      });
      setNewComment("");
      setActiveMention({ field: null, query: "" });
      toast.success("Comment posted successfully!");
    } catch (err) {
      console.error("Error creating comment:", err);
      const errorMessage =
        err.response?.data?.message ||
        "Failed to post comment. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleReply = async (parentId) => {
    if (!replyText.trim()) {
      toast.warning("Please enter a reply before submitting.");
      return;
    }

    try {
      await createComment({
        meetingId,
        body: replyText,
        parentComment: parentId,
      });
      setReplyText("");
      setReplyingTo(null);
      setActiveMention({ field: null, query: "" });
      toast.success("Reply posted successfully!");
    } catch (err) {
      console.error("Error posting reply:", err);
      const errorMessage =
        err.response?.data?.message ||
        "Failed to post reply. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) {
      toast.warning("Please enter text before updating the comment.");
      return;
    }

    try {
      await updateComment(commentId, { body: editText });
      setEditingComment(null);
      setEditText("");
      setActiveMention({ field: null, query: "" });
      toast.success("Comment updated successfully!");
    } catch (err) {
      console.error("Error updating comment:", err);
      const errorMessage =
        err.response?.data?.message ||
        "Failed to update comment. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      await deleteComment(commentId);
      toast.success("Comment deleted successfully!");
    } catch (err) {
      console.error("Error deleting comment:", err);
      const errorMessage =
        err.response?.data?.message ||
        "Failed to delete comment. Please try again.";
      toast.error(errorMessage);
    }
  };

  const handleToggleReaction = async (commentId, emoji) => {
    try {
      await toggleReaction(commentId, emoji);
    } catch (err) {
      console.error("Error toggling reaction:", err);
      const errorMessage =
        err.response?.data?.message ||
        "Failed to add reaction. Please try again.";
      toast.error(errorMessage);
    }
  };

  const renderComment = (comment, isReply = false) => {
    const isAuthor = comment.author?._id === userData?._id;
    const isEditing = editingComment === comment._id;

    return (
      <div
        key={comment._id}
        className={`${isReply ? "ml-8 mt-2" : "mt-4"} p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800`}
      >
        {isEditing ? (
          <div className="space-y-2 relative">
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) =>
                handleInputChange(
                  "edit",
                  e.target.value,
                  e.target.selectionStart,
                )
              }
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              rows={3}
            />
            {activeMention.field === "edit" && (
              <MentionPicker
                isOpen={true}
                query={activeMention.query}
                members={orgMembers}
                onSelect={handleSelectMember}
                onClose={() => setActiveMention({ field: null, query: "" })}
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleEditComment(comment._id)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 cursor-pointer"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingComment(null);
                  setEditText("");
                  setActiveMention({ field: null, query: "" });
                }}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                  {comment.author?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">
                    {comment.author?.name || "Unknown User"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(comment.createdAt).toLocaleString()}
                    {comment.isEdited && " (edited)"}
                  </p>
                </div>
              </div>
              {isAuthor && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingComment(comment._id);
                      setEditText(comment.body);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteComment(comment._id)}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
              {renderMentions(comment.body)}
            </p>

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleToggleReaction(comment._id, "👍")}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                👍{" "}
                {comment.reactions?.filter((r) => r && r.emoji === "👍")
                  .length || 0}
              </button>
              <button
                onClick={() => handleToggleReaction(comment._id, "❤️")}
                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                ❤️{" "}
                {comment.reactions?.filter((r) => r && r.emoji === "❤️")
                  .length || 0}
              </button>
              {!isReply && (
                <button
                  onClick={() => setReplyingTo(comment._id)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Reply
                </button>
              )}
            </div>

            {replyingTo === comment._id && (
              <div className="mt-2 space-y-2 relative">
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={(e) =>
                    handleInputChange(
                      "reply",
                      e.target.value,
                      e.target.selectionStart,
                    )
                  }
                  placeholder="Write a reply... Use @ to mention"
                  className="w-full p-2 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={2}
                />
                {activeMention.field === "reply" && (
                  <MentionPicker
                    isOpen={true}
                    query={activeMention.query}
                    members={orgMembers}
                    onSelect={handleSelectMember}
                    onClose={() => setActiveMention({ field: null, query: "" })}
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReply(comment._id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 cursor-pointer"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText("");
                      setActiveMention({ field: null, query: "" });
                    }}
                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Comments ({comments.length})
      </h3>

      <form onSubmit={handleCreateComment} className="mb-6 relative">
        <textarea
          ref={newCommentRef}
          value={newComment}
          onChange={(e) =>
            handleInputChange("new", e.target.value, e.target.selectionStart)
          }
          placeholder="Add a comment... Use @ to mention team members"
          className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          rows={3}
        />
        {activeMention.field === "new" && (
          <MentionPicker
            isOpen={true}
            query={activeMention.query}
            members={orgMembers}
            onSelect={handleSelectMember}
            onClose={() => setActiveMention({ field: null, query: "" })}
          />
        )}
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Post Comment
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
};

export default CommentSection;
