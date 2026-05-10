import { Question, VideoMetadata, Chapter } from "../types";

const FPS = 30;
const INTRO_DURATION_SEC = 4;
const SLEEP_SEC = 2;
const SLEEP_FRAMES = SLEEP_SEC * FPS;

function exampleSlideDurationFrames(audioDurationEnSec: number, audioDurationJaSec: number): number {
  const enFrames = Math.ceil(audioDurationEnSec * FPS);
  const jaFrames = Math.ceil(audioDurationJaSec * FPS);
  return enFrames + SLEEP_FRAMES + jaFrames + SLEEP_FRAMES + jaFrames + SLEEP_FRAMES;
}

function wordSectionFrames(examples: Array<{ audioDurationEnSec: number; audioDurationJaSec: number }>): number {
  const introFrames = INTRO_DURATION_SEC * FPS;
  const exFrames = examples.reduce(
    (sum, ex) => sum + exampleSlideDurationFrames(ex.audioDurationEnSec, ex.audioDurationJaSec),
    0
  );
  return introFrames + exFrames;
}

function framesToTimestamp(frames: number): string {
  const totalSec = Math.floor(frames / FPS);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function nowJST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function getEdition(): "Morning" | "Afternoon" | "Evening" {
  const hour = nowJST().getUTCHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export class MetadataBuilder {
  build(questions: Question[]): VideoMetadata {
    const now = new Date();
    const nowJst = nowJST();
    const edition = getEdition();
    const dateStr = formatDate(nowJst);
    const wordCount = questions.length;
    const exampleCount = questions.reduce((sum, q) => sum + q.examples.length, 0);

    const chapters = this.buildChapters(questions);
    const chapterLines = chapters.map((c) => `${c.timestamp} - ${c.title}`).join("\n");
    const wordList = questions.map((q) => q.jword).join("・");

    const title = `${wordCount} Japanese Words for Daily Conversation | ${edition} Edition (${dateStr})`;

    const description = `#LearnJapanese #JapaneseVocabulary #JLPT

Learn ${wordCount} essential Japanese words with ${exampleCount} example sentences in this comprehensive ${edition} Edition!

今日覚える単語: ${wordList}

📚 ${edition} Edition - Chapters:
${chapterLines}

🎯 What you'll learn:
• ${wordCount} commonly used Japanese words
• ${exampleCount} practical example sentences
• Proper pronunciation (romaji included)
• Real-life conversation usage

👥 Who is this for?
• Japanese language learners (JLPT N5-N3 level)
• Anyone interested in Japanese culture
• Students preparing for Japanese proficiency tests

💡 New editions uploaded daily! Subscribe for consistent Japanese learning content.`;

    const tags = [
      "Learn Japanese",
      "Japanese Vocabulary",
      "JLPT",
      "Japanese for beginners",
      "Japanese language",
      "日本語",
      ...questions.map((q) => q.jword),
      ...questions.map((q) => q.yomi),
    ];

    return {
      generatedAt: now.toISOString(),
      date: nowJst.toISOString().slice(0, 10),
      edition,
      type: "long",
      questions: questions.map((q) => ({ id: q.id, jword: q.jword, yomi: q.yomi })),
      seo: { title, description, tags, chapters },
    };
  }

  private buildChapters(questions: Question[]): Chapter[] {
    let cumFrames = 0;
    return questions.map((q) => {
      const timestamp = framesToTimestamp(cumFrames);
      cumFrames += wordSectionFrames(q.examples);
      return { timestamp, title: `${q.jword} (${q.yomi})` };
    });
  }
}
