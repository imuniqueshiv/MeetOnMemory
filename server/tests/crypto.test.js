import { jest } from "@jest/globals";
import { spawnSync } from "child_process";
import path from "path";

const { encryptToken, decryptToken } = await import("../utils/crypto.js");

describe("Crypto Token Encryption Utility (#2626)", () => {
  let originalEnv;
  let originalKey;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    originalKey = process.env.TOKEN_ENCRYPTION_KEY;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.TOKEN_ENCRYPTION_KEY = originalKey;
  });

  it("should encrypt and decrypt successfully when key is set", () => {
    process.env.TOKEN_ENCRYPTION_KEY =
      "my_super_secret_token_encryption_key_32";
    const plaintext = "slack-token-12345";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(plaintext);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should fail to encrypt/decrypt and throw error if key is unset in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.TOKEN_ENCRYPTION_KEY;

    expect(() => encryptToken("some-token")).toThrow(
      "TOKEN_ENCRYPTION_KEY is required but not set.",
    );

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    decryptToken("iv:encryptedText:authTag");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to decrypt Slack token"),
      expect.stringContaining("TOKEN_ENCRYPTION_KEY is required but not set."),
    );
    consoleErrorSpy.mockRestore();
  });

  it("should fail fast and exit with code 1 at boot if TOKEN_ENCRYPTION_KEY is unset in production", () => {
    const serverPath = path.resolve("server.js");
    const result = spawnSync("node", [serverPath], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        TOKEN_ENCRYPTION_KEY: "",
      },
    });

    expect(result.status).toBe(1);
    const stderr = result.stderr.toString();
    expect(stderr).toContain(
      "FATAL ERROR: TOKEN_ENCRYPTION_KEY environment variable is required but not set.",
    );
  });
});
