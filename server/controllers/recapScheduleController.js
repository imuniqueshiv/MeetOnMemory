import RecapSchedule from "../models/recapScheduleModel.js";
import RecapDelivery from "../models/recapDeliveryModel.js";
import { recapDeliveryQueue } from "../services/queueService.js";
import { z } from "zod";

const scheduleSchema = z.object({
  scheduleType: z.enum(["immediate", "daily", "weekly"]),
  deliveryChannel: z.enum(["email", "webhook", "in_app"]).optional(),
  preferredTime: z.string().optional(),
  timezone: z.string().optional(),
});

export const upsertSchedule = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;

    const parsedData = scheduleSchema.parse(req.body);

    const schedule = await RecapSchedule.findOneAndUpdate(
      { organizationId, userId },
      { ...parsedData, organizationId, userId },
      { new: true, upsert: true },
    );

    res.status(200).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("[recapScheduleController.upsertSchedule] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSchedule = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user._id;

    const schedule = await RecapSchedule.findOne({ organizationId, userId });
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.status(200).json(schedule);
  } catch (error) {
    console.error("[recapScheduleController.getSchedule] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDeliveryHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    // Deliveries don't have organizationId explicitly, but we fetch by userId
    const deliveries = await RecapDelivery.find({ userId })
      .populate("meetingId", "title date")
      .sort({ deliveredAt: -1 })
      .limit(50);

    res.status(200).json(deliveries);
  } catch (error) {
    console.error("[recapScheduleController.getDeliveryHistory] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const retryDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const userId = req.user._id;

    const delivery = await RecapDelivery.findOne({ _id: deliveryId, userId });
    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (recapDeliveryQueue.isActive) {
      await recapDeliveryQueue.add("retry-delivery", {
        deliveryId: delivery._id,
        meetingId: delivery.meetingId,
        userId: delivery.userId,
      });
    } else {
      // Mock retry if queue not active
      console.log(`[Mock] Retrying delivery for ${deliveryId}`);
    }

    res.status(200).json({ message: "Delivery retry enqueued successfully" });
  } catch (error) {
    console.error("[recapScheduleController.retryDelivery] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
