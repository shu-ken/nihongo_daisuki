import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { FPS, SLEEP_FRAMES, exampleSlideDurationFrames } from "../lib/timing";

const CONTAINER_WIDTH = 1800;
const EN_MAX_FONT = 50;
const JA_MAX_FONT = 100;
const ROMAJI_MAX_FONT = 50;

type Props = {
  sortOrder: number;
  en: string;
  ja: string;
  romaji: string;
  audioUrlEn: string;
  audioUrlJa: string;
  audioDurationEnSec: number;
  audioDurationJaSec: number;
};

export const ExampleSlide: React.FC<Props> = ({
  sortOrder, en, ja, romaji,
  audioUrlEn, audioUrlJa,
  audioDurationEnSec, audioDurationJaSec,
}) => {
  const enFrames = Math.ceil(audioDurationEnSec * FPS);
  const jaFrames = Math.ceil(audioDurationJaSec * FPS);

  const jaStart  = enFrames + SLEEP_FRAMES;
  const ja2Start = jaStart + jaFrames + SLEEP_FRAMES;

  const enFontSize = Math.min(
    fitText({ text: en, withinWidth: CONTAINER_WIDTH, fontFamily: "sans-serif" }).fontSize,
    EN_MAX_FONT
  );
  const jaFontSize = Math.min(
    fitText({ text: ja, withinWidth: CONTAINER_WIDTH, fontFamily: "sans-serif", fontWeight: "bold" }).fontSize,
    JA_MAX_FONT
  );
  const romajiFontSize = Math.min(
    fitText({ text: romaji, withinWidth: CONTAINER_WIDTH, fontFamily: "sans-serif" }).fontSize,
    ROMAJI_MAX_FONT
  );

  return (
    <AbsoluteFill style={{ position: "absolute", top: 660, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      {/* EN音声 */}
      <Audio src={audioUrlEn} />

      {/* JA音声1回目 */}
      <Sequence from={jaStart}>
        <Audio src={audioUrlJa} />
      </Sequence>

      {/* JA音声2回目 */}
      <Sequence from={ja2Start}>
        <Audio src={audioUrlJa} />
      </Sequence>

      {/* EN例文：常時表示 */}
      <div style={{ color: "#000000", fontSize: enFontSize, textAlign: "center" }}>
        {en}
      </div>

      {/* JA例文・ローマ字：JA開始から常時表示 */}
      <Sequence from={jaStart}>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 100 }}>
          <div style={{ color: "#000000", fontSize: jaFontSize, fontWeight: "bold", textAlign: "center" }}>
            {ja}
          </div>
          <div style={{ color: "#ff1900", fontSize: romajiFontSize, textAlign: "center" }}>
            {romaji}
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

export { exampleSlideDurationFrames };
