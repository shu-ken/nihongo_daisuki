import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { YouTubeUploader } from "../lib/YouTubeUploader";
import { SupabaseRepository } from "../lib/SupabaseRepository";
import { VideoMetadata } from "../types";

// ショートの公開予約オフセット（ロング公開時刻からの分）
// ロングA（朝07:00）→ 08:00, 10:00, 12:00, 14:00, 16:00
// ロングB（昼12:00）→ 17:00, 18:00, 19:00, 20:00, 21:00
// ロングC（夜22:00）→ 22:30, 00:00, 01:30, 03:00, 05:00
const EDITION_SCHEDULE: Record<string, string[]> = {
  Morning:   ["08:00", "10:00", "12:00", "14:00", "16:00"],
  Afternoon: ["17:00", "18:00", "19:00", "20:00", "21:00"],
  Evening:   ["22:30", "00:00", "01:30", "03:00", "05:00"],
};

function buildPublishAt(date: string, timeJST: string): string {
  const [h, m] = timeJST.split(":").map(Number);
  // 翌日扱い（00:00〜05:59は翌日）
  const d = new Date(`${date}T00:00:00+09:00`);
  if (h < 6) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  // JST → UTC
  return new Date(d.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

export class ShortVideoJob {
  private repo: SupabaseRepository;

  constructor(
    private projectRoot: string,
    private uploader: YouTubeUploader
  ) {
    this.repo = SupabaseRepository.fromEnv();
  }

  async run(metadataPath: string): Promise<void> {
    console.log("📱 ショート動画ジョブ開始");

    const metadata: VideoMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    const { date, edition, questions, videoId: longVideoId } = metadata;

    if (!questions || questions.length === 0) {
      throw new Error("metadata.json に questions が含まれていません");
    }

    const schedule = EDITION_SCHEDULE[edition] ?? EDITION_SCHEDULE["Morning"];
    const remotionEntry = path.join(this.projectRoot, "src/remotion/index.tsx");
    const outputDir = path.join(this.projectRoot, "output/shorts", date, edition.toLowerCase());
    fs.mkdirSync(outputDir, { recursive: true });

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const publishAt = buildPublishAt(date, schedule[i]);
      const outputPath = path.join(outputDir, `short_${i + 1}_${q.jword}.mp4`);

      console.log(`\n🎬 [${i + 1}/${questions.length}] ${q.jword} レンダリング中...`);

      // question の詳細データを取得して props に含める（Remotion がSupabaseを呼ばないよう）
      const question = await this.repo.fetchQuestion(q.id);

      const propsPath = path.join(this.projectRoot, "output", `props_short_${i}.json`);
      fs.writeFileSync(propsPath, JSON.stringify({ question, questionId: q.id }));

      const cmd = [
        "npx remotion render",
        `"${remotionEntry}"`,
        "WordShort",
        `"${outputPath}"`,
        `--props="${propsPath}"`,
        `--config="${path.join(this.projectRoot, "remotion.config.ts")}"`,
      ].join(" ");

      execSync(cmd, { stdio: "inherit", cwd: this.projectRoot });
      fs.unlinkSync(propsPath);
      console.log(`✅ レンダリング完了: ${outputPath}`);

      // YouTube 投稿（公開予約）
      const longUrl = longVideoId ? `https://www.youtube.com/watch?v=${longVideoId}` : "";
      const description = [
        `#Shorts #LearnJapanese #日本語`,
        "",
        longUrl ? `▶️ フル動画はこちら: ${longUrl}` : "",
      ].filter(Boolean).join("\n");

      const videoId = await this.uploader.upload(outputPath, {
        title: `「${q.jword}」- Japanese Word of the Day #Shorts`,
        description,
        tags: ["Shorts", "LearnJapanese", "日本語", q.jword, q.yomi],
        privacyStatus: "private",
        madeForKids: false,
        publishAt,
      });

      console.log(`✅ 投稿完了: https://www.youtube.com/watch?v=${videoId} (公開予約: ${publishAt})`);
    }

    console.log("\n🎉 ショート動画ジョブ完了");
  }
}
