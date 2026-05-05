// ---- Supabase DB ----

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

export type Question = {
  id: string;
  jword: string;
  yomi: string;
  yomi_kana: string;
  jlpt_level: string | null;
  wordAudioUrl: string;
  examples: Example[];
};

// ---- Video Metadata ----

export type Chapter = {
  timestamp: string;
  title: string;
};

export type SeoMetadata = {
  title: string;
  description: string;
  tags: string[];
  chapters: Chapter[];
};

export type VideoMetadata = {
  generatedAt: string;
  date: string;
  edition: "Morning" | "Afternoon" | "Evening";
  type: "long";
  questions: Array<{ id: string; jword: string; yomi: string }>;
  seo: SeoMetadata;
  files?: {
    video: string;
    videoPath: string;
  };
  videoId?: string;
  uploadedAt?: string;
};

// ---- Renderer ----

export type RendererConfig = {
  projectRoot: string;
  remotionEntry: string;
  compositionId: string;
  outputDir: string;
};

// ---- YouTube ----

export type UploadOptions = {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: "public" | "unlisted" | "private";
  madeForKids: boolean;
};
