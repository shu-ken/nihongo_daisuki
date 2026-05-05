import { createClient } from "@supabase/supabase-js";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

export type Example = {
  id: string;
  sort_order: number;
  en: string;
  ja: string;
  romaji: string;
  audioUrlEn: string;
  audioUrlJa: string;
  audioDurationEnSec: number;
  audioDurationJaSec: number;
};

export type QuestionData = {
  id: string;
  jword: string;
  yomi: string;
  yomi_kana: string;
  jlpt_level: string | null;
  wordAudioUrl: string;
  examples: Example[];
};

const SIGNED_URL_EXPIRES = 3600;

export async function fetchQuestions(questionIds: string[]): Promise<QuestionData[]> {
  return Promise.all(questionIds.map((id) => fetchQuestion(id)));
}

export async function fetchRandomQuestions(count: number = 5): Promise<QuestionData[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("ai_text_review", true)
    .eq("ai_audio_review", true);

  if (error || !data) throw new Error(`question一覧取得失敗: ${error?.message}`);

  // Fisher-Yatesシャッフルで重複なくcount件選出
  const ids = data.map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const selected = ids.slice(0, count);

  return fetchQuestions(selected);
}

export async function fetchQuestion(questionId: string): Promise<QuestionData> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: question, error: qErr } = await supabase
    .from("questions")
    .select("id, jword, yomi, yomi_kana, jlpt_level")
    .eq("id", questionId)
    .single();

  if (qErr || !question) throw new Error(`question取得失敗: ${qErr?.message}`);

  const { data: examples, error: eErr } = await supabase
    .from("examples")
    .select("id, sort_order, en, ja, romaji")
    .eq("question_id", questionId)
    .order("sort_order");

  if (eErr || !examples) throw new Error(`examples取得失敗: ${eErr?.message}`);

  const paths = [
    `${questionId}/word_ja.wav`,
    ...examples.flatMap((ex) => [
      `${questionId}/${ex.id}_en.wav`,
      `${questionId}/${ex.id}_ja.wav`,
    ]),
  ];

  const { data: signedUrls, error: urlErr } = await supabase.storage
    .from("audio")
    .createSignedUrls(paths, SIGNED_URL_EXPIRES);

  if (urlErr || !signedUrls) throw new Error(`署名付きURL生成失敗: ${urlErr?.message}`);

  const urlMap = new Map(signedUrls.map((u) => [u.path, u.signedUrl]));

  const examplesWithUrls = examples.map((ex) => ({
    ...ex,
    audioUrlEn: urlMap.get(`${questionId}/${ex.id}_en.wav`) ?? "",
    audioUrlJa: urlMap.get(`${questionId}/${ex.id}_ja.wav`) ?? "",
  }));

  // 各音声の長さを取得
  const examplesWithDuration = await Promise.all(
    examplesWithUrls.map(async (ex) => {
      const [durationEn, durationJa] = await Promise.all([
        getAudioDurationInSeconds(ex.audioUrlEn),
        getAudioDurationInSeconds(ex.audioUrlJa),
      ]);
      return {
        ...ex,
        audioDurationEnSec: durationEn,
        audioDurationJaSec: durationJa,
      };
    })
  );

  return {
    ...question,
    wordAudioUrl: urlMap.get(`${questionId}/word_ja.wav`) ?? "",
    examples: examplesWithDuration,
  };
}
