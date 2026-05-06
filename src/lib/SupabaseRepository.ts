import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { Question, Example } from "../types";
import ws from "ws";

const SIGNED_URL_EXPIRES = 21600; // 6時間（長時間レンダリングに対応）

function getAudioDurationSec(url: string): number {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${url}"`,
      { encoding: "utf8" }
    );
    return parseFloat(result.trim());
  } catch {
    return 3;
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
        const hasValidAudio = q.wordAudioUrl &&
          q.examples.every((ex) => ex.audioDurationEnSec > 0 && ex.audioDurationJaSec > 0);
        if (hasValidAudio) {
          results.push(q);
        } else {
          console.warn(`⚠️ 音声不正のためスキップ: ${q.jword} (${id})`);
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
      wordAudioUrl: urlMap.get(`${questionId}/word_ja.wav`) ?? "",
      examples: examplesWithDuration,
    };
  }
}
