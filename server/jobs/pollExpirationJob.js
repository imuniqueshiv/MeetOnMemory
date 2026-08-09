import cron from "node-cron";
import Poll from "../models/pollModel.js";

/**
 * Processes expired polls in configurable batches to prevent high memory usage.
 * @param {object} io - Socket.io server instance
 * @param {number} batchSize - Maximum number of polls to query per batch (default: 100)
 * @returns {Promise<number>} Total number of expired polls processed
 */
export const processExpiredPollsBatch = async (io, batchSize = 100) => {
  const now = new Date();
  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore) {
    const expiredPolls = await Poll.find({
      isClosed: false,
      expiresAt: { $lte: now },
    }).limit(batchSize);

    if (!expiredPolls || expiredPolls.length === 0) {
      hasMore = false;
      break;
    }

    for (const poll of expiredPolls) {
      poll.isClosed = true;
      const closedPoll = await poll.save();
      await closedPoll.populate("createdBy", "name email profilePicture");
      if (!poll.isAnonymous) {
        await closedPoll.populate("options.votes", "name email profilePicture");
      }

      // Format for response if anonymous
      let pollResponse = closedPoll;
      if (poll.isAnonymous) {
        const pollObj = closedPoll.toObject
          ? closedPoll.toObject()
          : closedPoll;
        pollObj.options = pollObj.options.map((option) => ({
          ...option,
          voteCount: option.votes ? option.votes.length : 0,
          votes: [],
        }));
        pollResponse = pollObj;
      }

      if (io) {
        io.to(poll.meeting.toString()).emit("poll:closed", pollResponse);
      }
      totalProcessed++;
    }

    if (expiredPolls.length < batchSize) {
      hasMore = false;
    }
  }

  return totalProcessed;
};

let isJobScheduled = false;

const startPollExpirationJob = (io, batchSize = 100) => {
  if (isJobScheduled) {
    console.log(
      "Poll expiration job already scheduled, skipping duplicate registration.",
    );
    return;
  }

  try {
    cron.schedule("*/5 * * * *", async () => {
      try {
        const processed = await processExpiredPollsBatch(io, batchSize);
        if (processed > 0) {
          console.log(
            `[Poll Expiration Job] Closed ${processed} expired poll(s).`,
          );
        }
      } catch (error) {
        console.error("Error in poll expiration cron job execution:", error);
      }
    });

    isJobScheduled = true;
    console.log(
      "Successfully initialized poll expiration background job " +
        "(schedule: */5 * * * *)",
    );
  } catch (error) {
    console.error(
      "Failed to initialize poll expiration background job:",
      error,
    );
  }
};

export default startPollExpirationJob;
