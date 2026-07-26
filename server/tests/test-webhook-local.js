import dotenv from "dotenv";
import mongoose from "mongoose";
import Webhook from "../models/Webhook.js";
import eventBus from "../services/eventBus.js";
import "../services/webhookDispatcherService.js"; // This registers the event listeners

dotenv.config();

const runLocalTest = async () => {
  try {
    let dbUri = process.env.MONGODB_URI;
    if (!dbUri) {
      console.error("❌ MONGODB_URI is not set in your .env file.");
      process.exit(1);
    }

    if (dbUri.endsWith("/")) {
      dbUri = dbUri.slice(0, -1);
    }

    // 1. Connect to your actual MongoDB
    await mongoose.connect(`${dbUri}/mern_auth`);
    console.log("🔋 Connected to MongoDB for local Webhook test.");

    const mockOrgId = new mongoose.Types.ObjectId();

    // 2. Clean up any previous test hooks to keep it idempotent
    await Webhook.deleteMany({ targetUrl: "https://httpbin.org/post" });

    // 3. Create Webhook subscription pointing to a public mock API (httpbin.org)
    const secret = "test_webhook_secret_key_123";
    const webhook = await Webhook.create({
      organizationId: mockOrgId,
      targetUrl: "https://httpbin.org/post",
      events: ["meeting.created"],
      secret: secret,
      isActive: true,
    });
    console.log("📝 Registered test webhook subscription in database.");
    console.log(`   - Target URL: ${webhook.targetUrl}`);

    console.log("\n📡 Emitting mock 'meeting.created' event via eventBus...");

    // 4. Emit the event onto the internal event bus.
    // The webhookDispatcherService will automatically intercept this,
    // format the payload, sign it, and send a POST request.
    eventBus.emit("meeting.created", {
      _id: new mongoose.Types.ObjectId(),
      title: "Local Standalone Webhook Test Meeting",
      description: "Verifying signature and integration logic.",
      date: new Date(),
      meetingType: "internal",
      organization: mockOrgId,
    });

    console.log("⏱️  Waiting 3 seconds for async dispatch to complete...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 5. Cleanup the test webhook
    await Webhook.deleteOne({ _id: webhook._id });
    console.log("🧹 Cleaned up test webhook from MongoDB.");

    await mongoose.disconnect();
    console.log("🏁 Test completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Local test error:", err);
    process.exit(1);
  }
};

runLocalTest();
