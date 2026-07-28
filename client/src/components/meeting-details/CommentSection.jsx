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

const CommentSection = ({ meetingId }) => {
  const { userData, backendUrl } = useContext(AppContent);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");

  const socketRef = useRef(null);

  useEffect(() => {
    // Fetch initial comments
    const fetchComments = async () => {
      try {
        const data = await getCommentsByMeeting(meetingId, 1, 100);
        setComments(data.comments || []);
      } catch (error) {
        console.error("Failed to fetch comments", error);
      }
    };
    fetchComments();

    // Socket connection for real-time
    socketRef.current = io(backendUrl, {
      withCredentials: true,
      transports: ["websocket"],
    });

    // In MeetOnMemory, clients join a room implicitly in some setups or explicitly
    // Here we'll rely on the server side taking care of it if they use a general connection,
    // or we might need to emit a join event if we modify meetingSocket to allow it.
    // However, meetingSocket expects "join-meeting" to be emitted. Let's emit it.
    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-meeting", {
        roomId: meetingId,
        userInfo: { name: userData?.name },
      });
    });

    socketRef.current.on("comment:new", (newCmt) => {
      setComments((prev) => {
        if (!newCmt.parentComment) {
          // Top level
          return [newCmt, ...prev];
        } else {
          // Reply
          return prev.map((c) => {
            if (c._id === newCmt.parentComment) {
              const replies = c.replies || [];
              return { ...c, replies: [...replies, newCmt] };
            }
            return c;
          });
        }
      });
    });

    socketRef.current.on("comment:update", (updatedCmt) => {
      setComments((prev) => {
        return prev.map((c) => {
          if (c._id === updatedCmt._id)
            return { ...c, ...updatedCmt, replies: c.replies };
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r._id === updatedCmt._id ? updatedCmt : r,
              ),
            };
          }
          return c;
        });
      });
    });

    socketRef.current.on("comment:delete", ({ id, parentComment }) => {
      setComments((prev) => {
        if (!parentComment) {
          return prev.filter((c) => c._id !== id);
        } else {
          return prev.map((c) => {
            if (c._id === parentComment) {
              return { ...c, replies: c.replies.filter((r) => r._id !== id) };
            }
            return c;
          });
        }
      });
    });

    socketRef.current.on("comment:reaction", (updatedCmt) => {
      setComments((prev) => {
        return prev.map((c) => {
          if (c._id === updatedCmt._id)
            return {
              ...c,
              reactions: updatedCmt.reactions,
              replies: c.replies,
            };
          if (c.replies) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r._id === updatedCmt._id
                  ? { ...r, reactions: updatedCmt.reactions }
                  : r,
              ),
            };
          }
          return c;
        });
      });
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [meetingId, backendUrl, userData]);

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await createComment(meetingId, newComment);
      setNewComment("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleReply = async (e, parentId) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    try {
      await createComment(meetingId, replyBody, parentId);
      setReplyBody("");
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = async (e, id) => {
    e.preventDefault();
    if (!editBody.trim()) return;
    try {
      await updateComment(id, editBody);
      setEditingId(null);
      setEditBody("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this comment?"))
      return;
    try {
      await deleteComment(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReaction = async (id, emoji) => {
    try {
      await toggleReaction(id, emoji);
    } catch (err) {
      console.error(err);
    }
  };

  const emojis = ["👍", "🎉", "❤️", "🤔"];

  const renderComment = (c, isReply = false) => {
    const isAuthor =
      userData &&
      c.author &&
      (c.author._id === userData._id || c.author === userData._id);
    const isAdmin =
      userData && (userData.role === "admin" || userData.role === "owner");
    const canDelete = isAuthor || isAdmin;

    return (
      <div
        key={c._id}
        className={`p-4 mb-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${isReply ? "ml-8" : ""}`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
              {c.author?.name ? c.author.name.charAt(0).toUpperCase() : "?"}
            </div>
            <div>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {c.author?.name || "Unknown"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                {new Date(c.createdAt).toLocaleString()}{" "}
                {c.isEdited && "(edited)"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {isAuthor && (
              <button
                onClick={() => {
                  setEditingId(c._id);
                  setEditBody(c.body);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Edit
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => handleDelete(c._id)}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {editingId === c._id ? (
          <form onSubmit={(e) => handleEdit(e, c._id)} className="mt-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {c.body}
          </p>
        )}

        <div className="mt-3 flex items-center gap-4">
          <div className="flex gap-1">
            {emojis.map((emoji) => {
              const count =
                c.reactions?.filter((r) => r.emoji === emoji).length || 0;
              const hasReacted = c.reactions?.some(
                (r) => r.emoji === emoji && r.user._id === userData._id,
              );
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(c._id, emoji)}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                    hasReacted
                      ? "bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-700/50 dark:border-gray-600 dark:hover:bg-gray-700"
                  }`}
                >
                  <span>{emoji}</span>{" "}
                  {count > 0 && <span className="font-medium">{count}</span>}
                </button>
              );
            })}
          </div>
          {!isReply && (
            <button
              onClick={() => {
                setReplyingTo(replyingTo === c._id ? null : c._id);
                setReplyBody("");
              }}
              className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Reply
            </button>
          )}
        </div>

        {replyingTo === c._id && (
          <form onSubmit={(e) => handleReply(e, c._id)} className="mt-4 ml-8">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write a reply..."
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Reply
              </button>
            </div>
          </form>
        )}

        {/* Render Replies */}
        {!isReply && c.replies && c.replies.length > 0 && (
          <div className="mt-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            {c.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
        Comments
      </h3>

      <form onSubmit={handleCreateComment} className="mb-8">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Leave a comment..."
          className="w-full p-3 border rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="3"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Post Comment
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {comments.map((c) => renderComment(c))}
        {comments.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            No comments yet. Be the first to start a discussion!
          </p>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
