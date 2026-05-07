import React from "react";
import { AbsoluteFill, Audio, Series, Img, staticFile } from "remotion";
import { ExampleSlide } from "../slides/ExampleSlide";
import { FPS, INTRO_DURATION_SEC, exampleSlideDurationFrames, wordSectionFrames } from "../lib/timing";
import { QuestionData } from "../lib/fetchQuestion";

export type WordShortProps = {
  question: QuestionData | null;
  questionId: string;
};

const Background: React.FC = () => (
  <Img
    src={staticFile("bg_short.png")}
    style={{ width: "100%", height: "100%", objectFit: "cover" }}
  />
);

export const WordShort: React.FC<WordShortProps> = ({ question }) => {
  if (!question) return null;

  return (
    <AbsoluteFill>
      <Background />

      <AbsoluteFill>
        {/* 単語ヘッダー */}
        <div style={{
          position: "absolute",
          top: 200,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}>
          <div style={{ color: "#000000", fontSize: 180, fontWeight: "bold", lineHeight: 1 }}>
            {question.jword}
          </div>
          <div style={{ color: "#ff1900", fontSize: 90 }}>
            {question.yomi}
          </div>
        </div>

        {/* 音声・例文スライド */}
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
    </AbsoluteFill>
  );
};

export const wordShortDurationInFrames = (question: QuestionData): number =>
  wordSectionFrames(question.examples);
