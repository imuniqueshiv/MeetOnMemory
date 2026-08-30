import logger from '../utils/logger.js';

// Map to track active room connections
const activeRooms = new Map();

/**
 * Initialize icebreaker socket handlers
 */
export const initializeIcebreakerSocket = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Icebreaker socket connected: ${socket.id}`);

    // Join icebreaker room
    socket.on('icebreaker:join', (data) => {
      try {
        const { meetingId, userId } = data;
        
        if (!meetingId || !userId) {
          socket.emit('icebreaker:error', { 
            error: 'Meeting ID and User ID are required' 
          });
          return;
        }

        const roomName = `icebreaker-${meetingId}`;
        socket.join(roomName);
        
        // Track room membership
        if (!activeRooms.has(roomName)) {
          activeRooms.set(roomName, new Set());
        }
        activeRooms.get(roomName).add(socket.id);

        logger.info(`User ${userId} joined icebreaker room ${roomName}`);
        socket.emit('icebreaker:joined', { 
          meetingId, 
          room: roomName,
          timestamp: new Date().toISOString(),
        });

        // Notify others
        socket.to(roomName).emit('icebreaker:user_joined', {
          userId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Error joining icebreaker room:', error);
        socket.emit('icebreaker:error', { error: error.message });
      }
    });

    // Leave icebreaker room
    socket.on('icebreaker:leave', (data) => {
      try {
        const { meetingId } = data;
        const roomName = `icebreaker-${meetingId}`;
        socket.leave(roomName);
        
        if (activeRooms.has(roomName)) {
          activeRooms.get(roomName).delete(socket.id);
          if (activeRooms.get(roomName).size === 0) {
            activeRooms.delete(roomName);
          }
        }
        
        logger.info(`Socket ${socket.id} left icebreaker room ${roomName}`);
      } catch (error) {
        logger.error('Error leaving icebreaker room:', error);
      }
    });

    // Handle typing indicator
    socket.on('icebreaker:typing', (data) => {
      try {
        const { meetingId, userId, isTyping } = data;
        const roomName = `icebreaker-${meetingId}`;
        socket.to(roomName).emit('icebreaker:typing', {
          userId,
          isTyping,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Error handling typing:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Remove socket from all rooms
      for (const [roomName, sockets] of activeRooms) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            activeRooms.delete(roomName);
          }
          logger.info(`Socket ${socket.id} removed from room ${roomName}`);
        }
      }
    });
  });
};

/**
 * Emit an icebreaker event to a meeting room
 */
export const emitIcebreakerEvent = (meetingId, event, data) => {
  try {
    const roomName = `icebreaker-${meetingId}`;
    const io = global.io; // Access from app.js
    
    if (!io) {
      logger.warn('Socket.IO instance not available');
      return;
    }

    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
      event,
    };

    io.to(roomName).emit(`icebreaker:${event}`, payload);
    logger.info(`Emitted ${event} event to room ${roomName}`);
  } catch (error) {
    logger.error(`Error emitting icebreaker event:`, error);
  }
};

/**
 * Get active participants in an icebreaker room
 */
export const getRoomParticipants = (meetingId) => {
  const roomName = `icebreaker-${meetingId}`;
  return activeRooms.get(roomName) || new Set();
};

export default {
  initializeIcebreakerSocket,
  emitIcebreakerEvent,
  getRoomParticipants,
};