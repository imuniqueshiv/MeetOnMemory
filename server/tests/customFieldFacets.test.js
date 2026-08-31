import mongoose from "mongoose";
import {
  getMeetingsWithFacets,
  updateMeetingCustomFields,
} from "../controllers/customFieldController.js";
import CustomFieldDefinition from "../models/customFieldDefinitionModel.js";
import CustomFieldValue from "../models/customFieldValueModel.js";
import Meeting from "../models/meetingModel.js";

const ORG_ID = new mongoose.Types.ObjectId();

describe("customFieldController facets & meeting fields persistence", () => {
  let meeting1, _meeting2, defProject;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(
        process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/test_db",
      );
    }
  });

  beforeEach(async () => {
    await CustomFieldDefinition.deleteMany({});
    await CustomFieldValue.deleteMany({});
    await Meeting.deleteMany({});

    defProject = await CustomFieldDefinition.create({
      organization: ORG_ID,
      name: "ProjectCode",
      type: "dropdown",
      options: ["Alpha", "Beta", "Gamma"],
      required: false,
    });

    meeting1 = await Meeting.create({
      title: "Project Alpha Sync",
      date: new Date(),
      uploadedBy: new mongoose.Types.ObjectId(),
      organization: ORG_ID,
      customFields: [
        {
          key: "ProjectCode",
          name: "ProjectCode",
          value: "Alpha",
          definitionId: defProject._id,
        },
      ],
    });

    _meeting2 = await Meeting.create({
      title: "Project Beta Sync",
      date: new Date(),
      uploadedBy: new mongoose.Types.ObjectId(),
      organization: ORG_ID,
      customFields: [
        {
          key: "ProjectCode",
          name: "ProjectCode",
          value: "Beta",
          definitionId: defProject._id,
        },
      ],
    });
  });

  describe("getMeetingsWithFacets", () => {
    it("filters meetings by custom field key and value", async () => {
      const req = {
        user: { organization: { _id: ORG_ID } },
        body: {
          filters: [{ key: "ProjectCode", value: "Alpha" }],
        },
      };
      const res = {
        status: function (code) {
          this.statusCode = code;
          return this;
        },
        json: function (data) {
          this.data = data;
          return this;
        },
      };

      await getMeetingsWithFacets(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.meetings.length).toBe(1);
      expect(res.data.meetings[0].title).toBe("Project Alpha Sync");
    });

    it("returns all organization meetings when filters are empty", async () => {
      const req = {
        user: { organization: { _id: ORG_ID } },
        body: { filters: [] },
      };
      const res = {
        status: function (code) {
          this.statusCode = code;
          return this;
        },
        json: function (data) {
          this.data = data;
          return this;
        },
      };

      await getMeetingsWithFacets(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.meetings.length).toBe(2);
    });

    it("rejects unauthenticated or organizationless requests with 403", async () => {
      const req = { user: {} };
      const res = {
        status: function (code) {
          this.statusCode = code;
          return this;
        },
        json: function (data) {
          this.data = data;
          return this;
        },
      };

      await getMeetingsWithFacets(req, res);
      expect(res.statusCode).toBe(403);
    });
  });

  describe("updateMeetingCustomFields", () => {
    it("persists updated custom field values to target meeting", async () => {
      const req = {
        user: { organization: { _id: ORG_ID } },
        params: { meetingId: meeting1._id.toString() },
        body: {
          customFields: [
            {
              definitionId: defProject._id.toString(),
              value: "Gamma",
            },
          ],
        },
      };
      const res = {
        status: function (code) {
          this.statusCode = code;
          return this;
        },
        json: function (data) {
          this.data = data;
          return this;
        },
      };

      await updateMeetingCustomFields(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.meeting.customFields[0].value).toBe("Gamma");
    });
  });
});
