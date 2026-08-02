import {
  sanitizeFilenameForHeader,
  getContentDispositionHeader,
} from "../utils/fileUtils.js";

describe("sanitizeFilenameForHeader", () => {
  it("should leave safe filenames unchanged", () => {
    expect(sanitizeFilenameForHeader("document.pdf")).toBe("document.pdf");
    expect(sanitizeFilenameForHeader("meeting-notes-2024.txt")).toBe(
      "meeting-notes-2024.txt",
    );
    expect(sanitizeFilenameForHeader("graph-snapshot-123.json")).toBe(
      "graph-snapshot-123.json",
    );
    expect(sanitizeFilenameForHeader("transcript-abc123.txt")).toBe(
      "transcript-abc123.txt",
    );
  });

  it("should remove carriage returns (CR)", () => {
    expect(sanitizeFilenameForHeader("file\rname.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\r\rname.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("\rfile.pdf")).toBe("file.pdf");
    expect(sanitizeFilenameForHeader("file.pdf\r")).toBe("file.pdf");
  });

  it("should remove line feeds (LF)", () => {
    expect(sanitizeFilenameForHeader("file\nname.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\n\nname.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("\nfile.pdf")).toBe("file.pdf");
    expect(sanitizeFilenameForHeader("file.pdf\n")).toBe("file.pdf");
  });

  it("should remove both CR and LF", () => {
    expect(sanitizeFilenameForHeader("file\r\nname.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\n\rname.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\r\n\r\nname.pdf")).toBe(
      "filename.pdf",
    );
  });

  it("should remove control characters (0x00-0x1F)", () => {
    expect(sanitizeFilenameForHeader("file\x00name.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\x01name.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\x1Fname.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\tname.pdf")).toBe("filename.pdf"); // Tab is 0x09
  });

  it("should remove DEL character (0x7F)", () => {
    expect(sanitizeFilenameForHeader("file\x7Fname.pdf")).toBe("filename.pdf");
  });

  it("should remove double quotes", () => {
    expect(sanitizeFilenameForHeader('file"name.pdf')).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader('"file.pdf"')).toBe("file.pdf");
    expect(sanitizeFilenameForHeader('file".pdf')).toBe("file.pdf");
  });

  it("should preserve single quotes", () => {
    expect(sanitizeFilenameForHeader("file'name.pdf")).toBe("file'name.pdf");
    expect(sanitizeFilenameForHeader("'file.pdf'")).toBe("'file.pdf'");
    expect(sanitizeFilenameForHeader("file'.pdf")).toBe("file'.pdf");
  });

  it("should remove backslashes", () => {
    expect(sanitizeFilenameForHeader("file\\name.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("file\\\\name.pdf")).toBe("filename.pdf");
    expect(sanitizeFilenameForHeader("\\file.pdf")).toBe("file.pdf");
  });

  it("should handle multiple unsafe characters in combination", () => {
    expect(sanitizeFilenameForHeader("file\r\n\"name'\t.pdf")).toBe(
      "filename'.pdf",
    );
    expect(sanitizeFilenameForHeader("file\x00\"name'\r\n.pdf")).toBe(
      "filename'.pdf",
    );
  });

  it("should preserve valid special characters", () => {
    expect(sanitizeFilenameForHeader("file-name.pdf")).toBe("file-name.pdf");
    expect(sanitizeFilenameForHeader("file_name.pdf")).toBe("file_name.pdf");
    expect(sanitizeFilenameForHeader("file.name.pdf")).toBe("file.name.pdf");
    expect(sanitizeFilenameForHeader("file name.pdf")).toBe("file name.pdf");
    expect(sanitizeFilenameForHeader("file(name).pdf")).toBe("file(name).pdf");
    expect(sanitizeFilenameForHeader("file[name].pdf")).toBe("file[name].pdf");
    expect(sanitizeFilenameForHeader("file{data}.pdf")).toBe("file{data}.pdf");
  });

  it("should handle empty string", () => {
    expect(sanitizeFilenameForHeader("")).toBe("");
  });

  it("should handle null/undefined", () => {
    expect(sanitizeFilenameForHeader(null)).toBe("");
    expect(sanitizeFilenameForHeader(undefined)).toBe("");
  });

  it("should handle filenames with only unsafe characters", () => {
    expect(sanitizeFilenameForHeader("\r\n")).toBe("");
    expect(sanitizeFilenameForHeader('"\\')).toBe("");
    expect(sanitizeFilenameForHeader("\x00\x01\x02")).toBe("");
  });

  it("should prevent header injection attempts", () => {
    // Attempt to inject a new header
    expect(
      sanitizeFilenameForHeader("file.pdf\r\nX-Injected-Header: malicious"),
    ).toBe("file.pdfX-Injected-Header: malicious");

    // Attempt to inject content after header
    expect(sanitizeFilenameForHeader("file.pdf\r\n\r\nmalicious content")).toBe(
      "file.pdfmalicious content",
    );

    // Attempt to inject with quotes
    expect(
      sanitizeFilenameForHeader('file.pdf"; filename="malicious.pdf'),
    ).toBe("file.pdf; filename=malicious.pdf");
  });

  it("should handle Unicode characters", () => {
    expect(sanitizeFilenameForHeader("文件.pdf")).toBe("文件.pdf");
    expect(sanitizeFilenameForHeader("fichier-é.pdf")).toBe("fichier-é.pdf");
    expect(sanitizeFilenameForHeader("datei-ü.pdf")).toBe("datei-ü.pdf");
  });

  it("should handle very long filenames", () => {
    const longFilename = "a".repeat(1000) + ".pdf";
    const result = sanitizeFilenameForHeader(longFilename);
    expect(result).toBe(longFilename);
  });
});

describe("getContentDispositionHeader", () => {
  it("should generate RFC 8187 compliant header for ascii filenames", () => {
    expect(getContentDispositionHeader("document.pdf")).toBe(
      `attachment; filename="document.pdf"; filename*=UTF-8''document.pdf`,
    );
  });

  it("should encode Unicode characters properly", () => {
    expect(getContentDispositionHeader("réunion.pdf")).toBe(
      `attachment; filename="réunion.pdf"; filename*=UTF-8''r%C3%A9union.pdf`,
    );
  });

  it("should sanitize the fallback ascii filename", () => {
    expect(getContentDispositionHeader('bad"name.pdf')).toBe(
      `attachment; filename="badname.pdf"; filename*=UTF-8''bad%22name.pdf`,
    );
  });
});
