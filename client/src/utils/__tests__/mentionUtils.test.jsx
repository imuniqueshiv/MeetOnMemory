// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  extractMentionQuery,
  insertMention,
  renderMentions,
} from "../mentionUtils.jsx";

describe("mentionUtils", () => {
  describe("extractMentionQuery", () => {
    it("detects when typing @ at cursor position", () => {
      const text = "Hello @";
      const result = extractMentionQuery(text, text.length);
      expect(result.isMentioning).toBe(true);
      expect(result.query).toBe("");
    });

    it("detects partial name typed after @", () => {
      const text = "Checking with @John for updates";
      const cursor = "Checking with @John".length;
      const result = extractMentionQuery(text, cursor);
      expect(result.isMentioning).toBe(true);
      expect(result.query).toBe("John");
    });

    it("returns false when no @ is present", () => {
      const text = "Hello world";
      const result = extractMentionQuery(text, text.length);
      expect(result.isMentioning).toBe(false);
    });
  });

  describe("insertMention", () => {
    it("replaces @query with mention tag format at cursor position", () => {
      const text = "Hey @Jo, please review";
      const cursor = "Hey @Jo".length;
      const member = { _id: "user-999", name: "John Doe" };

      const { newText } = insertMention(text, cursor, member);
      expect(newText).toBe("Hey @[John Doe](user-999) , please review");
    });
  });

  describe("renderMentions", () => {
    it("returns plain string if no mentions are present", () => {
      const text = "Regular text without mentions";
      const rendered = renderMentions(text);
      expect(rendered).toBe(text);
    });

    it("parses mention markup into react element array", () => {
      const text = "Cc @[Alice Smith](u-1) and @Bob";
      const rendered = renderMentions(text);
      expect(Array.isArray(rendered)).toBe(true);
      expect(rendered.length).toBeGreaterThan(1);
    });
  });
});
