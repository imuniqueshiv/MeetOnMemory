import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userModel from "./models/userModel.js";
import Organization from "./models/organizationModel.js";
import Meeting from "./models/meetingModel.js";

dotenv.config();

const port = process.env.PORT || 4000;
const API_URL = `http://localhost:${port}/api`;
let userAToken = "";
let userBToken = "";
let meetingId = "";
let orgId = "";
let userA_id = "";
let userB_id = ""; // eslint-disable-line no-unused-vars

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true, // Don't throw errors on 4xx/5xx responses
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms)); // eslint-disable-line no-unused-vars

async function runTests() {
  try {
    console.log("==========================================");
    console.log("🚀 Starting RBAC & Org Scoping Integration Tests");
    console.log("==========================================");

    // 1. Connect to DB to manipulate records directly for setup
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clean up previous test runs
    await userModel.deleteMany({
      email: { $in: ["usera@test.com", "userb@test.com"] },
    });
    await Organization.deleteMany({ name: "Test Org RBAC" });

    // 2. Register Users
    console.log("👤 Registering User A...");
    let _resA = await api.post("/auth/register", {
      name: "User A",
      email: "usera@test.com",
      password: "password123",
    });

    console.log("👤 Registering User B...");
    let _resB = await api.post("/auth/register", {
      name: "User B",
      email: "userb@test.com",
      password: "password123",
    });

    // 3. Login and get Tokens
    console.log("🔑 Logging in User A...");
    const loginA = await api.post("/auth/login", {
      email: "usera@test.com",
      password: "password123",
    });
    userAToken = loginA.headers["set-cookie"]
      ? loginA.headers["set-cookie"][0].split(";")[0].split("=")[1]
      : null;

    console.log("🔑 Logging in User B...");
    const loginB = await api.post("/auth/login", {
      email: "userb@test.com",
      password: "password123",
    });
    userBToken = loginB.headers["set-cookie"]
      ? loginB.headers["set-cookie"][0].split(";")[0].split("=")[1]
      : null;

    if (!userAToken || !userBToken) {
      // Fallback if cookies are not set, try to get from response if token is returned in body
      // MeetOnMemory auth controller sets a cookie. We need to extract it, or mock it if cookie fails.
      console.log(
        "⚠️ Could not extract token from cookies. Make sure backend is running and returns set-cookie.",
      );
    }

    // 4. Setup Organization in DB
    const userA = await userModel.findOne({ email: "usera@test.com" });
    const userB = await userModel.findOne({ email: "userb@test.com" });
    userA_id = userA._id;
    userB_id = userB._id;

    const org = await Organization.create({
      name: "Test Org RBAC",
      createdBy: userA._id,
      members: [userA._id, userB._id],
    });
    orgId = org._id;

    // Set roles and orgs
    userA.organization = org._id;
    userA.role = "member";
    await userA.save();

    userB.organization = org._id;
    userB.role = "member";
    await userB.save();

    console.log(
      "✅ Created Test Organization and assigned roles (User A: member, User B: member)",
    );

    // 5. Create a Meeting as User A
    const meeting = await Meeting.create({
      title: "User A's Test Meeting",
      uploadedBy: userA._id,
      organization: org._id,
      date: new Date(),
      status: "completed",
      summary: "Test summary",
    });
    meetingId = meeting._id;
    console.log(`✅ Created Meeting ID: ${meetingId} (Owned by User A)`);

    // --- TEST 1: Visibility (Organization Scoping) ---
    console.log("\n--- TEST 1: Visibility (Organization Scoping) ---");
    const getMeetingsRes = await api.get("/meetings/all", {
      headers: { Cookie: `token=${userBToken}` },
    });

    const found = getMeetingsRes.data.meetings?.find(
      (m) => m._id === meetingId.toString(),
    );
    if (found) {
      console.log("✅ PASS: User B can see User A's meeting (Same Org)");
    } else {
      console.error("❌ FAIL: User B cannot see User A's meeting");
    }

    // --- TEST 2: RBAC Enforcement (Deletion by Member) ---
    console.log("\n--- TEST 2: RBAC Enforcement (Deletion by Member) ---");
    const deleteRes1 = await api.delete(`/meetings/delete/${meetingId}`, {
      headers: { Cookie: `token=${userBToken}` },
    });

    if (deleteRes1.status === 403) {
      console.log(
        "✅ PASS: User B (member) is FORBIDDEN (403) from deleting User A's meeting",
      );
    } else {
      console.error(
        `❌ FAIL: User B deletion returned status ${deleteRes1.status} (Expected 403)`,
      );
    }

    // --- TEST 3: RBAC Enforcement (Deletion by Admin) ---
    console.log("\n--- TEST 3: RBAC Enforcement (Deletion by Admin) ---");

    // Promote User B to Admin
    userB.role = "admin";
    await userB.save();
    console.log("⬆️  Promoted User B to Admin in database");

    const deleteRes2 = await api.delete(`/meetings/delete/${meetingId}`, {
      headers: { Cookie: `token=${userBToken}` },
    });

    if (deleteRes2.status === 200) {
      console.log(
        "✅ PASS: User B (admin) SUCCESSFULLY deleted User A's meeting",
      );
    } else {
      console.error(
        `❌ FAIL: User B deletion returned status ${deleteRes2.status} (Expected 200)`,
      );
    }

    // --- TEST 4: Edit Restrictions (Ownership) ---
    console.log("\n--- TEST 4: Edit Restrictions (Ownership) ---");

    // Create new meeting for User A
    const meeting2 = await Meeting.create({
      title: "User A's Second Meeting",
      uploadedBy: userA._id,
      organization: org._id,
      date: new Date(),
    });

    const editRes = await api.put(
      `/meetings/${meeting2._id}`,
      { title: "Hacked Title" },
      { headers: { Cookie: `token=${userBToken}` } },
    );

    if (editRes.status === 403) {
      console.log(
        "✅ PASS: User B (admin) is FORBIDDEN (403) from editing User A's meeting (Only Owner can edit)",
      );
    } else {
      console.error(
        `❌ FAIL: User B edit returned status ${editRes.status} (Expected 403)`,
      );
    }

    // Clean up
    console.log("\n🧹 Cleaning up test data...");
    await userModel.deleteMany({
      email: { $in: ["usera@test.com", "userb@test.com"] },
    });
    await Organization.deleteOne({ _id: orgId });
    await Meeting.deleteMany({ uploadedBy: userA_id });

    console.log("\n🎉 All tests finished!");
  } catch (error) {
    console.error("❌ Test script failed:", error.message || error);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  } finally {
    mongoose.disconnect();
  }
}

runTests();
