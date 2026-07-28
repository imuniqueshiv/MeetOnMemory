import { encryptToken, decryptToken } from "../services/calendarService.js";
import CalendarConnection from "../models/calendarConnectionModel.js";
import mongoose from "mongoose";

describe("Calendar Sync & Service Tests", () => {
  describe("Token Encryption & Decryption", () => {
    it("should correctly encrypt and decrypt tokens", () => {
      const rawToken = "ya29.a0AfH6SMD_example_google_access_token_12345";
      const encrypted = encryptToken(rawToken);

      expect(encrypted).not.toBe(rawToken);
      expect(typeof encrypted).toBe("string");

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(rawToken);
    });

    it("should return null when decrypting null or undefined token", () => {
      expect(decryptToken(null)).toBeNull();
      expect(decryptToken(undefined)).toBeNull();
    });
  });

  describe("CalendarConnection Model Schema", () => {
    it("should allow creating connections for both google and microsoft for a single user", async () => {
      const dummyUserId = new mongoose.Types.ObjectId();

      const googleConn = new CalendarConnection({
        user: dummyUserId,
        provider: "google",
        accessToken: encryptToken("google_token_123"),
        refreshToken: encryptToken("google_refresh_123"),
        syncStatus: "connected",
      });

      const msConn = new CalendarConnection({
        user: dummyUserId,
        provider: "microsoft",
        accessToken: encryptToken("ms_token_123"),
        refreshToken: encryptToken("ms_refresh_123"),
        syncStatus: "connected",
      });

      expect(googleConn.provider).toBe("google");
      expect(msConn.provider).toBe("microsoft");
      expect(googleConn.user.toString()).toBe(dummyUserId.toString());
      expect(msConn.user.toString()).toBe(dummyUserId.toString());
    });

    it("should support outlook as a valid provider enum", () => {
      const dummyUserId = new mongoose.Types.ObjectId();
      const outlookConn = new CalendarConnection({
        user: dummyUserId,
        provider: "outlook",
        accessToken: encryptToken("outlook_token"),
      });

      expect(outlookConn.provider).toBe("outlook");
    });
  });
});
