import { jest } from "@jest/globals";
import dns from "dns/promises";

const lookupSpy = jest.spyOn(dns, "lookup");
const resolve4Spy = jest.spyOn(dns, "resolve4");
const resolve6Spy = jest.spyOn(dns, "resolve6");

const { validateWebhookDestination, isSafeWebhookUrl } =
  await import("../utils/webhookUrlSafety.js");

describe("webhookUrlSafety", () => {
  afterEach(() => {
    lookupSpy.mockReset();
    resolve4Spy.mockReset();
    resolve6Spy.mockReset();
  });

  afterAll(() => {
    lookupSpy.mockRestore();
    resolve4Spy.mockRestore();
    resolve6Spy.mockRestore();
  });

  it("accepts a public hostname", async () => {
    lookupSpy.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    const result = await validateWebhookDestination(
      "https://example.com/hooks",
    );

    expect(result.ok).toBe(true);
    expect(result.pinnedAddress).toBe("93.184.216.34");
    expect(result.family).toBe(4);
    await expect(isSafeWebhookUrl("https://example.com/hooks")).resolves.toBe(
      true,
    );
  });

  it("rejects localhost hostnames without DNS", async () => {
    const result = await validateWebhookDestination(
      "https://localhost:3000/hook",
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not allowed/i);
    expect(lookupSpy).not.toHaveBeenCalled();
  });

  it("rejects private IPv4 destinations", async () => {
    lookupSpy.mockResolvedValue([{ address: "10.0.0.8", family: 4 }]);

    const result = await validateWebhookDestination(
      "https://hooks.internal.example/webhook",
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/private or local/i);
  });

  it("rejects loopback destinations", async () => {
    lookupSpy.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    const result = await validateWebhookDestination("https://evil.test/hook");

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/private or local/i);
  });

  it("rejects when any resolved address is private", async () => {
    lookupSpy.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.20", family: 4 },
    ]);

    const result = await validateWebhookDestination(
      "https://mixed.example/hook",
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/192\.168\.1\.20/);
  });

  it("rejects link-local / metadata style addresses", async () => {
    lookupSpy.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

    const result = await validateWebhookDestination(
      "https://metadata.example/latest",
    );

    expect(result.ok).toBe(false);
  });

  it("rejects non-https protocols including http", async () => {
    const httpResult = await validateWebhookDestination(
      "http://example.com/hook",
    );
    expect(httpResult.ok).toBe(false);
    expect(httpResult.reason).toMatch(/must use https:\/\//i);

    const ftpResult = await validateWebhookDestination(
      "ftp://example.com/hook",
    );
    expect(ftpResult.ok).toBe(false);
    expect(ftpResult.reason).toMatch(/must use https:\/\//i);
  });
});
