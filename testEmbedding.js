// testEmbedding.js
import { generateEmbedding, searchVectorStore, addToVectorStore } from "./server/utils/embeddingUtils.js";

(async () => {
  try {
    const mockMeeting = {
      _id: "12345",
      title: "AI Policy Discussion",
      summary: "Team discussed AI ethics and project timelines.",
      transcript: "AI regulations and ethics compliance review."
    };

    await addToVectorStore(mockMeeting);
    const res = await searchVectorStore("AI ethics meeting");
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Error running test:", err);
  }
})();
