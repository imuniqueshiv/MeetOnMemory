import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { expect } from "chai";
import { app } from "../server.js";
import GlossaryTerm from "../models/glossaryTermModel.js";
import glossaryService from "../services/glossaryService.js";
import Meeting from "../models/meetingModel.js";
import * as GenerativeAIService from "../services/GenerativeAIService.js";

describe("Glossary Service", () => {
  const orgId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("detectTerms", () => {
    it("should detect known terms in text, case-insensitively, respecting word boundaries", async () => {
      const termObj = await GlossaryTerm.create({
        organization: orgId,
        term: "ROI",
        definition: "Return on Investment",
        aliases: ["Return On Investment"],
        approvalStatus: "approved",
      });

      const text =
        "What is the ROI for this project? Let's check the return on investment.";

      const matches = await glossaryService.detectTerms(text, orgId);

      expect(matches).to.be.an("array").with.length(2);

      const roiMatch = matches.find((m) => m.matchedText === "ROI");
      expect(roiMatch).to.not.be.undefined;
      expect(roiMatch.termId.toString()).to.equal(termObj._id.toString());
      expect(roiMatch.definition).to.equal("Return on Investment");

      const aliasMatch = matches.find(
        (m) => m.matchedText.toLowerCase() === "return on investment",
      );
      expect(aliasMatch).to.not.be.undefined;
      expect(aliasMatch.termId.toString()).to.equal(termObj._id.toString());
    });

    it("should not match substrings within larger words", async () => {
      await GlossaryTerm.create({
        organization: orgId,
        term: "API",
        definition: "Application Programming Interface",
        approvalStatus: "approved",
      });

      const text =
        "We need a new CAPITOL building, and also a new API endpoint.";
      const matches = await glossaryService.detectTerms(text, orgId);

      expect(matches).to.have.length(1);
      expect(matches[0].matchedText).to.equal("API");
    });
  });

  describe.skip("aiExtractTerms", () => {
    it("should extract new terms from a meeting transcript using AI, excluding known ones", async () => {
      const meetingId = new mongoose.Types.ObjectId();
      const uploadedBy = new mongoose.Types.ObjectId();

      await Meeting.create({
        _id: meetingId,
        organization: orgId,
        uploadedBy: uploadedBy,
        title: "Project Review",
        date: new Date(),
        transcript:
          "The K8s cluster needs to be scaled up. We also need to check the ROI.",
      });

      // Add ROI as a known term
      await GlossaryTerm.create({
        organization: orgId,
        term: "ROI",
        definition: "Return on Investment",
        approvalStatus: "approved",
      });

      // Stub GenerativeAIService
      jest.spyOn(GenerativeAIService, "generateText").mockResolvedValue(
        JSON.stringify([
          {
            term: "K8s",
            definition:
              "Kubernetes, an open-source container orchestration system",
            category: "Engineering",
          },
          {
            term: "ROI", // the AI should not return this if the prompt works, but if it does, the service should filter it
            definition: "Return on Investment",
            category: "Finance",
          },
        ]),
      );

      const suggestions = await glossaryService.aiExtractTerms(
        meetingId,
        orgId,
      );

      expect(suggestions).to.be.an("array").with.length(1);
      expect(suggestions[0].term).to.equal("K8s");
      expect(suggestions[0].approvalStatus).to.equal("pending");
      expect(suggestions[0].isAutoSuggested).to.be.true;

      const termsInDb = await GlossaryTerm.find({ organization: orgId });
      expect(termsInDb).to.have.length(2); // ROI (approved) + K8s (pending)
    });
  });
});
