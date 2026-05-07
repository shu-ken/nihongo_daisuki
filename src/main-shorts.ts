import "dotenv/config";
import path from "path";
import { GoogleAuth } from "./lib/GoogleAuth";
import { YouTubeUploader } from "./lib/YouTubeUploader";
import { ShortVideoJob } from "./jobs/ShortVideoJob";

async function main() {
  const metadataPath = process.argv[2];
  if (!metadataPath) {
    throw new Error("使い方: node dist/main-shorts.js <metadata.jsonのパス>");
  }

  const projectRoot = path.resolve(__dirname, "..");

  const auth = new GoogleAuth();
  const authClient = await auth.getAuthClient();
  const uploader = new YouTubeUploader(authClient);

  const job = new ShortVideoJob(projectRoot, uploader);
  await job.run(path.resolve(metadataPath));
}

main().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
