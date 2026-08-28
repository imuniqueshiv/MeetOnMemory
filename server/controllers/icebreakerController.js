// server/controllers/icebreakerController.js

// Mock persistent storage for session-scoped icebreaker states
const icebreakerSessions = {};

const getSessionData = (roomId) => {
  if (!icebreakerSessions[roomId]) {
    icebreakerSessions[roomId] = { current: null, history: [], reactions: {} };
  }
  return icebreakerSessions[roomId];
};

export const selectIcebreaker = (io, roomId, icebreakerText) => {
  const session = getSessionData(roomId);

  // Push old one to history if it exists
  if (session.current) {
    session.history.unshift({
      text: session.current,
      timestamp: new Date(),
      reactions: { ...session.reactions },
    });
  }

  // Set new state
  session.current = icebreakerText;
  session.reactions = { "🔥": 0, "😂": 0, "❤️": 0, "🙌": 0 };

  // Broadcast updated live state to everyone in the room
  io.to(roomId).emit("icebreaker:sync", {
    current: session.current,
    history: session.history,
    reactions: session.reactions,
  });
};

export const handleIcebreakerReaction = (io, roomId, emoji) => {
  const session = getSessionData(roomId);
  if (session.reactions[emoji] !== undefined) {
    session.reactions[emoji] += 1;
  }

  // Broadcast dynamic live feedback delta
  io.to(roomId).emit("icebreaker:reaction_update", {
    reactions: session.reactions,
  });
};
