import cron from "node-cron";
import Poll from "../models/pollModel.js";

const startPollExpirationJob = (io) => {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      // Find all polls that are not closed and have expired
      const expiredPolls = await Poll.find({
        isClosed: false,
        expiresAt: { $lte: new Date() },
      });

      if (expiredPolls.length === 0) return;

      for (const poll of expiredPolls) {
        poll.isClosed = true;
        const closedPoll = await poll.save();
        await closedPoll.populate("createdBy", "name email profilePicture");
        if (!poll.isAnonymous) {
          await closedPoll.populate(
            "options.votes",
            "name email profilePicture",
          );
        }

        // Format for response if anonymous
        let pollResponse = closedPoll;
        if (poll.isAnonymous) {
          const pollObj = closedPoll.toObject
            ? closedPoll.toObject()
            : closedPoll;
          pollObj.options = pollObj.options.map((option) => ({
            ...option,
            voteCount: option.votes.length,
            votes: [],
          }));
          pollResponse = pollObj;
        }

        if (io) {
          io.to(poll.meeting.toString()).emit("poll:closed", pollResponse);
        }
      }
    } catch (error) {
      console.error("Error in poll expiration cron job:", error);
    }
  });
};

export default startPollExpirationJob;
