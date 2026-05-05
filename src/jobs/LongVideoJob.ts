import fs from "fs";
import path from "path";
import { SupabaseRepository } from "../lib/SupabaseRepository";
import { MetadataBuilder } from "../lib/MetadataBuilder";
import { RemotionRenderer } from "../lib/RemotionRenderer";
import { YouTubeUploader } from "../lib/YouTubeUploader";
import { VideoMetadata } from "../types";

const QUESTION_COUNT = 5;

export class LongVideoJob {
  constructor(
    private repo: SupabaseRepository,
    private metadataBuilder: MetadataBuilder,
    private renderer: RemotionRenderer,
    private uploader: YouTubeUploader
  ) {}

  async run(): Promise<void> {
    console.log("📦 ロング動画ジョブ開始");

    // 1. 問題取得
    console.log(`🎲 問題をランダム選出中 (${QUESTION_COUNT}問)...`);
    const questions = await this.repo.fetchRandomQuestions(QUESTION_COUNT);
    console.log(`✅ 選出: ${questions.map((q) => q.jword).join("・")}`);

    // 2. メタデータ生成
    const metadata = this.metadataBuilder.build(questions);
    console.log(`📝 タイトル: ${metadata.seo.title}`);

    // 3. 動画レンダリング
    const outputVideoPath = this.renderer.buildOutputPath(metadata.date, metadata.edition);
    console.log(`🎬 レンダリング開始: ${outputVideoPath}`);
    this.renderer.render(questions, outputVideoPath);
    console.log("✅ レンダリング完了");

    // 4. metadata.json 保存
    const metadataWithFile: VideoMetadata = {
      ...metadata,
      files: {
        video: path.relative(path.dirname(outputVideoPath), outputVideoPath),
        videoPath: outputVideoPath,
      },
    };
    const metadataPath = path.join(path.dirname(outputVideoPath), "..", "metadata.json");
    fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
    fs.writeFileSync(metadataPath, JSON.stringify(metadataWithFile, null, 2));
    console.log(`✅ メタデータ保存: ${metadataPath}`);

    // 5. YouTube 投稿
    console.log("📤 YouTube にアップロード中...");
    const videoId = await this.uploader.upload(outputVideoPath, {
      title: metadata.seo.title,
      description: metadata.seo.description,
      tags: metadata.seo.tags,
      privacyStatus: "public",
      madeForKids: false,
    });

    // 6. videoId を metadata.json に記録（再実行時の重複投稿防止）
    const uploaded: VideoMetadata = {
      ...metadataWithFile,
      videoId,
      uploadedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(uploaded, null, 2));

    console.log("\n🎉 完了！");
    console.log(`   動画: https://www.youtube.com/watch?v=${videoId}`);
    console.log(`   タイトル: ${metadata.seo.title}`);
    console.log("   チャプター:");
    metadata.seo.chapters.forEach((c) => console.log(`     ${c.timestamp} - ${c.title}`));
  }
}
