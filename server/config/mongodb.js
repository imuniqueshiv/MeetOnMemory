import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("Database connected"),
    );

    const rawUri =
      process.env.NODE_ENV === "test" && process.env.TEST_MONGODB_URI
        ? process.env.TEST_MONGODB_URI
        : process.env.MONGODB_URI;

    // Strip trailing slash to avoid double-slash database name
    const dbUri = rawUri.endsWith("/") ? rawUri.slice(0, -1) : rawUri;

    // Determine the database name to use
    const dbName = process.env.MONGODB_DB_NAME || "meetonmemory";

    // Use URI as-is if it already includes a database path, otherwise append the database name
    // A MongoDB URI has a database path if it has more than 3 path segments (protocol, host, port, database)
    const uriPathSegments = dbUri.split("/").length;
    const connectionUri = uriPathSegments > 3 ? dbUri : `${dbUri}/${dbName}`;

    await mongoose.connect(connectionUri);
    const sanitizedUri = dbUri.replace(
      /(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/,
      "$1****$3",
    );

    // Extract and log the resolved database name
    const resolvedDbName = connectionUri.split("/").pop();
    console.log("Mongo URI:", sanitizedUri);
    console.log("Database:", resolvedDbName);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.warn(
      "Server running without database connection. Some features may not work.",
    );
  }
};

export default connectDB;
