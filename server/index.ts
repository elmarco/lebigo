import { capsule, endpoint, mutation, query, string, table, text } from "lakebed/server";

const CHUNK_SIZE = 60000;

export default capsule({
  name: "lebigo",

  schema: {
    recordings: table({
      mimeType: string(),
      ownerId: string(),
      displayName: string(),
      picture: string(),
      chunkCount: string(),
      duration: string(),
    }),
    audioChunks: table({
      recordingId: string(),
      chunkIndex: string(),
      data: string(),
    }),
  },

  queries: {
    allRecordings: query((ctx) => {
      return ctx.db.recordings
        .orderBy("updatedAt", "desc")
        .all();
    }),
  },

  mutations: {
    saveRecording: mutation(
      (ctx, audioData: string, mimeType: string, displayName: string, picture: string, duration: string) => {
        const existingRecs = ctx.db.recordings
          .where("ownerId", ctx.auth.userId)
          .all();
        for (const rec of existingRecs) {
          const chunks = ctx.db.audioChunks
            .where("recordingId", rec.id)
            .all();
          for (const chunk of chunks) {
            ctx.db.audioChunks.delete(chunk.id);
          }
          ctx.db.recordings.delete(rec.id);
        }

        const totalChunks = Math.ceil(audioData.length / CHUNK_SIZE);
        const rec = ctx.db.recordings.insert({
          mimeType,
          ownerId: ctx.auth.userId,
          displayName,
          picture,
          chunkCount: String(totalChunks),
          duration,
        });

        for (let i = 0; i < totalChunks; i++) {
          ctx.db.audioChunks.insert({
            recordingId: rec.id,
            chunkIndex: String(i).padStart(4, "0"),
            data: audioData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
          });
        }
      }
    ),

    deleteRecording: mutation((ctx) => {
      const existingRecs = ctx.db.recordings
        .where("ownerId", ctx.auth.userId)
        .all();
      for (const rec of existingRecs) {
        const chunks = ctx.db.audioChunks
          .where("recordingId", rec.id)
          .all();
        for (const chunk of chunks) {
          ctx.db.audioChunks.delete(chunk.id);
        }
        ctx.db.recordings.delete(rec.id);
      }
    }),
  },

  endpoints: {
    audio: endpoint({ method: "GET", path: "/api/audio" }, (ctx, req) => {
      const id = req.query.get("id");
      if (!id) return text("");
      const chunks = ctx.db.audioChunks
        .where("recordingId", id)
        .orderBy("chunkIndex", "asc")
        .all();
      return text(chunks.map((c) => c.data).join(""));
    }),
  },
});
