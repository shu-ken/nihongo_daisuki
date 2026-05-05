import React from "react";
import { AbsoluteFill, Audio, Series, Img, staticFile } from "remotion";
import { ExampleSlide } from "../slides/ExampleSlide";
import { FPS, INTRO_DURATION_SEC, exampleSlideDurationFrames, wordSectionFrames } from "../lib/timing";
import { QuestionData } from "../lib/fetchQuestion";

export type WordVideoProps = {
  questions: QuestionData[];
  questionIds: string[];
};

const Background: React.FC = () => (
  <Img
    src={staticFile("bg.png")}
    style={{ width: "100%", height: "100%", objectFit: "cover" }}
  />
);

export const WordVideo: React.FC<WordVideoProps> = ({ questions }) => {
  return (
    <AbsoluteFill>
      <Background />

      <Series>
        {questions.map((question) => (
          <Series.Sequence key={question.id} durationInFrames={wordSectionFrames(question.examples)}>
            <AbsoluteFill>
              {/* 常時表示：単語ヘッダー */}
              <div style={{ position: "absolute", top: 120, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <div style={{ color: "#000000", fontSize: 160, fontWeight: "bold", lineHeight: 1 }}>
                  {question.jword}
                </div>
                <div style={{ color: "#ff1900", fontSize: 80 }}>
                  {question.yomi}
                </div>
              </div>

              <Series>
                <Series.Sequence durationInFrames={INTRO_DURATION_SEC * FPS}>
                  <Audio src={question.wordAudioUrl} />
                </Series.Sequence>
                {question.examples.map((ex) => (
                  <Series.Sequence
                    key={ex.id}
                    durationInFrames={exampleSlideDurationFrames(ex.audioDurationEnSec, ex.audioDurationJaSec)}
                  >
                    <ExampleSlide
                      sortOrder={ex.sort_order}
                      en={ex.en}
                      ja={ex.ja}
                      romaji={ex.romaji}
                      audioUrlEn={ex.audioUrlEn}
                      audioUrlJa={ex.audioUrlJa}
                      audioDurationEnSec={ex.audioDurationEnSec}
                      audioDurationJaSec={ex.audioDurationJaSec}
                    />
                  </Series.Sequence>
                ))}
              </Series>
            </AbsoluteFill>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};

export const wordVideoDurationInFrames = (questions: QuestionData[]): number =>
  questions.reduce((sum, q) => sum + wordSectionFrames(q.examples), 0);
