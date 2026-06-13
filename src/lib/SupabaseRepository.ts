import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "child_process";
import { tmpdir, arch, platform } from "os";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { Question, Example } from "../types";
import ws from "ws";

const SIGNED_URL_EXPIRES = 21600; // 6時間（長時間レンダリングに対応）

function getRemotionFfprobePath(): string {
  const p = platform();
  const a = arch();
  let pkgName: string;
  if (p === "linux") {
    pkgName = a === "arm64"
      ? "@remotion/compositor-linux-arm64-gnu"
      : "@remotion/compositor-linux-x64-gnu";
  } else if (p === "darwin") {
    pkgName = a === "arm64"
      ? "@remotion/compositor-darwin-arm64"
      : "@remotion/compositor-darwin-x64";
  } else {
    return "ffprobe";
  }
  try {
    // require.resolveでnode_modules内のパスを取得
    const resolved = require.resolve(`${pkgName}/package.json`);
    return join(resolved, "..", "ffprobe");
  } catch {
    return "ffprobe";
  }
}

const REMOTION_FFPROBE = getRemotionFfprobePath();

function getAudioDurationSec(url: string): number {
  const tmpFile = join(tmpdir(), `audio-check-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
  try {
    const dl = spawnSync("curl", ["-sSfL", "--max-time", "15", "-o", tmpFile, url], {
      encoding: "utf8",
      timeout: 20000,
    });
    if (dl.status !== 0) return 0;

    // Remotionが実際に実行するのと同じバイナリ・同じフラグでバリデーション
    const probe = spawnSync(REMOTION_FFPROBE, [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=channels:stream=start_time:format=duration:format=format_name",
      "-of", "default=nw=1",
      tmpFile,
    ], { encoding: "utf8", timeout: 10000 });
    if (probe.status !== 0) return 0;

    const durationMatch = probe.stdout.match(/^duration=(.+)$/m);
    if (!durationMatch) return 0;
    const val = parseFloat(durationMatch[1]);
    if (isNaN(val) || val <= 0) return 0;

    return val;
  } catch {
    return 0;
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  }
}

export class SupabaseRepository {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      realtime: { transport: ws as any },
    });
  }

  static fromEnv(): SupabaseRepository {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です");
    return new SupabaseRepository(url, key);
  }

  async fetchRandomQuestions(count: number): Promise<Question[]> {
    const { data, error } = await this.client
      .from("questions")
      .select("id")
      .eq("ai_text_review", true)
      .eq("ai_audio_review", true);

    if (error || !data) throw new Error(`question一覧取得失敗: ${error?.message}`);

    const ids = data.map((q: { id: string }) => q.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    // 音声が破損している問題をスキップしながら必要数を集める
    const results: Question[] = [];
    for (const id of ids) {
      if (results.length >= count) break;
      try {
        const q = await this.fetchQuestion(id);
        const hasValidAudio = q.wordAudioDurationSec > 0 &&
          q.examples.every((ex) => ex.audioDurationEnSec > 0 && ex.audioDurationJaSec > 0);
        if (hasValidAudio) {
          results.push(q);
        } else {
          console.warn(`⚠️ 音声不正のためスキップ: ${q.jword} (${id})`);
          await this.resetAudioReview(id);
        }
      } catch (e) {
        console.warn(`⚠️ 取得失敗のためスキップ: ${id}`);
      }
    }

    if (results.length < count) {
      throw new Error(`有効な問題が${count}問見つかりませんでした（${results.length}問のみ取得）`);
    }

    return results;
  }

  async fetchQuestions(ids: string[]): Promise<Question[]> {
    return Promise.all(ids.map((id) => this.fetchQuestion(id)));
  }

  async fetchQuestion(questionId: string): Promise<Question> {
    const { data: question, error: qErr } = await this.client
      .from("questions")
      .select("id, jword, yomi, yomi_kana, jlpt_level")
      .eq("id", questionId)
      .single();

    if (qErr || !question) throw new Error(`question取得失敗 (${questionId}): ${qErr?.message}`);

    const { data: examples, error: eErr } = await this.client
      .from("examples")
      .select("id, sort_order, en, ja, romaji")
      .eq("question_id", questionId)
      .order("sort_order");

    if (eErr || !examples) throw new Error(`examples取得失敗 (${questionId}): ${eErr?.message}`);

    const audioPaths = [
      `${questionId}/word_ja.wav`,
      ...examples.flatMap((ex: { id: string }) => [
        `${questionId}/${ex.id}_en.wav`,
        `${questionId}/${ex.id}_ja.wav`,
      ]),
    ];

    const { data: signedUrls, error: urlErr } = await this.client.storage
      .from("audio")
      .createSignedUrls(audioPaths, SIGNED_URL_EXPIRES);

    if (urlErr || !signedUrls) throw new Error(`署名付きURL生成失敗: ${urlErr?.message}`);

    const urlMap = new Map(
      signedUrls
        .filter((u) => u.path !== null && u.signedUrl !== null)
        .map((u) => [u.path as string, u.signedUrl as string])
    );

    const wordAudioUrl = urlMap.get(`${questionId}/word_ja.wav`) ?? "";
    const wordAudioDurationSec = getAudioDurationSec(wordAudioUrl);

    const examplesWithDuration: Example[] = examples.map((ex: { id: string; sort_order: number; en: string; ja: string; romaji: string }) => {
      const audioUrlEn = urlMap.get(`${questionId}/${ex.id}_en.wav`) ?? "";
      const audioUrlJa = urlMap.get(`${questionId}/${ex.id}_ja.wav`) ?? "";
      return {
        ...ex,
        audioUrlEn,
        audioUrlJa,
        audioDurationEnSec: getAudioDurationSec(audioUrlEn),
        audioDurationJaSec: getAudioDurationSec(audioUrlJa),
      };
    });

    return {
      ...question,
      wordAudioUrl,
      wordAudioDurationSec,
      examples: examplesWithDuration,
    };
  }

  private async resetAudioReview(questionId: string): Promise<void> {
    const { error } = await this.client
      .from("questions")
      .update({ ai_audio_review: false })
      .eq("id", questionId);
    if (error) {
      console.warn(`⚠️ ai_audio_review リセット失敗 (${questionId}): ${error.message}`);
    } else {
      console.log(`🔄 ai_audio_review を false にリセット: ${questionId}`);
    }
  }

  async resetAudioReviewBatch(questionIds: string[]): Promise<void> {
    await Promise.all(questionIds.map((id) => this.resetAudioReview(id)));
  }
}
