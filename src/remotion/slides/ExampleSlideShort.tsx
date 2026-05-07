import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { FPS, SLEEP_FRAMES, exampleSlideDurationFrames } from "../lib/timing";

const CONTAINER_WIDTH = "100%";
const EN_MAX_FONT = 60;
const JA_MAX_FONT = 90;
const ROMAJI_MAX_FONT = 60;

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

export const ExampleSlideShort: React.FC<Props> = ({
  sortOrder, en, ja, romaji,
  audioUrlEn, audioUrlJa,
  audioDurationEnSec, audioDurationJaSec,
}) => {
  const enFrames = Math.ceil(audioDurationEnSec * FPS);
  const jaFrames = Math.ceil(audioDurationJaSec * FPS);

  const jaStart = enFrames + SLEEP_FRAMES;
  const ja2Start = jaStart + jaFrames + SLEEP_FRAMES;

  const enFontSize = Math.min(
    EN_MAX_FONT
  );
  const jaFontSize = Math.min(
    JA_MAX_FONT
  );
  const romajiFontSize = Math.min(
    ROMAJI_MAX_FONT
  );

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
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

      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        position: "absolute",
        top: 1100,
      }}>
        {/* EN例文：常時表示 */}
        <div style={{
          color: "#000000",
          fontSize: enFontSize,
          textAlign: "center",
          width: CONTAINER_WIDTH,
        }}>
          {en}
        </div>

        {/* JA例文・ローマ字：JA開始から常時表示 */}
        <Sequence from={jaStart} style={{
          position: "unset",
        }}>
          <div style={{
            width: CONTAINER_WIDTH,
          }}>
            <div style={{ color: "#000000", fontSize: jaFontSize, fontWeight: "bold", textAlign: "center" }}>
              {ja}
            </div>
            <div style={{ color: "#ff1900", fontSize: romajiFontSize, textAlign: "center" }}>
              {romaji}
            </div>
          </div>
        </Sequence>
      </div>

    </AbsoluteFill>
  );
};

export { exampleSlideDurationFrames };
