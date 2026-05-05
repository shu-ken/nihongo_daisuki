import "dotenv/config";
import path from "path";
import { SupabaseRepository } from "./lib/SupabaseRepository";
import { MetadataBuilder } from "./lib/MetadataBuilder";
import { RemotionRenderer } from "./lib/RemotionRenderer";
import { GoogleAuth } from "./lib/GoogleAuth";
import { YouTubeUploader } from "./lib/YouTubeUploader";
import { LongVideoJob } from "./jobs/LongVideoJob";

async function main() {
  const projectRoot = path.resolve(__dirname, "..");

  const repo = SupabaseRepository.fromEnv();
  const metadataBuilder = new MetadataBuilder();
  const renderer = RemotionRenderer.fromProjectRoot(projectRoot);

  const auth = new GoogleAuth();
  const authClient = await auth.getAuthClient();
  const uploader = new YouTubeUploader(authClient);

  const job = new LongVideoJob(repo, metadataBuilder, renderer, uploader);
  await job.run();
}

main().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
