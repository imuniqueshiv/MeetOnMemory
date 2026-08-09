import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, "..", "uploads", "exports");

const DEFAULT_RETENTION_HOURS = 24;

export default async function cleanupExpiredExportsJob() {
  const retentionHours =
    Number(process.env.EXPORT_RETENTION_HOURS) || DEFAULT_RETENTION_HOURS;

  const retentionMs = retentionHours * 60 * 60 * 1000;
  const expiryTime = Date.now() - retentionMs;

  try {
    const files = await fs.readdir(EXPORT_DIR);

    let deletedCount = 0;

    for (const fileName of files) {
      // Only clean up generated ZIP exports.
      if (!fileName.endsWith(".zip")) continue;

      const filePath = path.join(EXPORT_DIR, fileName);

      try {
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < expiryTime) {
          await fs.unlink(filePath);
          deletedCount++;

          console.log(`🗑️ Deleted expired export: ${fileName}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process export ${fileName}:`, error.message);
      }
    }

    console.log(
      `✅ Export cleanup completed. Deleted ${deletedCount} expired file(s).`,
    );

    return {
      success: true,
      deletedCount,
    };
  } catch (error) {
    // The directory may not exist yet if no export has ever been created.
    if (error.code === "ENOENT") {
      console.log(
        "ℹ️ Export directory does not exist yet. Nothing to clean up.",
      );

      return {
        success: true,
        deletedCount: 0,
      };
    }

    console.error("❌ Export cleanup job failed:", error.message);

    throw error;
  }
}
