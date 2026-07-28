import Reaction from "../models/reactionModel.js";
import mongoose from "mongoose";

export const getReactionSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    const summary = await Reaction.aggregate([
      { $match: { meeting: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: "$emoji", count: { $sum: 1 } } },
    ]);

    const formattedSummary = summary.map((item) => ({
      emoji: item._id,
      count: item.count,
    }));

    res.status(200).json({
      success: true,
      summary: formattedSummary,
    });
  } catch (error) {
    next(error);
  }
};

export const getReactionTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;

    const timeline = await Reaction.find({ meeting: id })
      .sort({ timestamp: 1 })
      .select("emoji timestamp transcriptSegmentIndex user")
      .populate("user", "name email");

    res.status(200).json({
      success: true,
      timeline,
    });
  } catch (error) {
    next(error);
  }
};
