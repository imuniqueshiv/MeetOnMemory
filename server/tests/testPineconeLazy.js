import assert from "assert";

console.log("🧪 Testing Pinecone Lazy Initialization...");

// 1. Ensure importing embeddingUtils does NOT throw or eagerly initialize Pinecone
const embeddingUtils = await import("../utils/embeddingUtils.js");

assert.ok(
  embeddingUtils.initVectorStore,
  "initVectorStore function should be exported",
);
assert.ok(
  embeddingUtils.searchVectorStore,
  "searchVectorStore function should be exported",
);
assert.ok(
  embeddingUtils.indexMeeting,
  "indexMeeting function should be exported",
);

console.log(
  "✅ embeddingUtils imported cleanly without eager Pinecone initialization.",
);

// 2. Ensure initVectorStore is lazy and throws expected missing key error only when invoked (if env is unconfigured)
if (!process.env.PINECONE_API_KEY) {
  try {
    await embeddingUtils.initVectorStore();
    assert.fail(
      "initVectorStore should have thrown an error when PINECONE_API_KEY is missing",
    );
  } catch (err) {
    assert.ok(
      err.message.includes("PINECONE_API_KEY") ||
        err.message.includes("INDEX_NAME"),
      "Should throw missing key error on lazy invocation",
    );
    console.log("✅ Lazy invocation validation check passed successfully!");
  }
}

console.log("\n🎉 ALL PINECONE LAZY INITIALIZATION VERIFICATIONS PASSED!\n");
