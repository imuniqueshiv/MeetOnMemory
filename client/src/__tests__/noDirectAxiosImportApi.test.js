const fs = require("fs");
const path = require("path");

describe("API modules must not import axios directly", () => {
  const apiDir = path.resolve(__dirname, "../api");
  const files = fs
    .readdirSync(apiDir)
    .filter((f) => f.endsWith(".js") && !f.includes(".test."));

  files.forEach((file) => {
    it(`${file} should not import axios directly`, () => {
      const content = fs.readFileSync(path.join(apiDir, file), "utf8");
      const hasDirectAxiosImport = /import\s+axios\s+from\s+["']axios["']/.test(
        content
      );
      expect(hasDirectAxiosImport).toBe(false);
    });
  });
});
