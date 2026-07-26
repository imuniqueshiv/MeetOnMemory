import { jest } from "@jest/globals";
const nodemailerMock = {
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "real-id" }),
    verify: jest.fn().mockImplementation((cb) => cb(null, true)),
  }),
};

jest.unstable_mockModule("nodemailer", () => {
  return {
    default: nodemailerMock,
  };
});

jest.unstable_mockModule("dotenv", () => {
  return {
    default: { config: jest.fn() },
  };
});

describe("nodeMailer lazy initialization test", () => {
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("should export a transporter object with sendMail and verify methods", async () => {
    const { default: transporter } = await import(
      `../config/nodeMailer.js?test=1`
    );
    expect(transporter).toBeDefined();
    expect(typeof transporter.sendMail).toBe("function");
    expect(typeof transporter.verify).toBe("function");
  });

  test("should resolve verify and sendMail when SMTP is in mock mode", async () => {
    // Clear SMTP env so we are in mock mode
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const { default: transporter } = await import(
      `../config/nodeMailer.js?test=2`
    );
    const spyLog = jest.spyOn(console, "log").mockImplementation(() => {});

    // Test verify
    const verifyCallback = jest.fn();
    transporter.verify(verifyCallback);
    expect(verifyCallback).toHaveBeenCalledWith(null, true);

    // Test sendMail
    const mailOptions = {
      to: "test@example.com",
      subject: "Test",
      text: "Hello",
    };
    const result = await transporter.sendMail(mailOptions);
    expect(result.messageId).toContain("mock-id-");
    expect(spyLog).toHaveBeenCalledWith("✉️ MOCK EMAIL SENT");

    spyLog.mockRestore();
  });

  test("should initialize real transport only when real SMTP variables are defined and method is called", async () => {
    // Set dummy SMTP credentials so SMTP is not mocked
    process.env.SMTP_USER = "test@example.com";
    process.env.SMTP_PASS = "securepassword";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";

    const { default: transporter } = await import(
      `../config/nodeMailer.js?test=3`
    );

    // Re-verify that createTransport was NOT called simply by loading/setting env
    expect(nodemailerMock.createTransport).not.toHaveBeenCalled();

    // Call sendMail (which should trigger lazy initialization of real transporter)
    const mailOptions = {
      to: "user@example.com",
      subject: "Real SMTP Test",
      text: "Real mail contents",
    };
    const res = await transporter.sendMail(mailOptions); // eslint-disable-line no-unused-vars

    // Assert createTransport was called with correct configuration
    expect(nodemailerMock.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: {
        user: "test@example.com",
        pass: "securepassword",
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  });
});
