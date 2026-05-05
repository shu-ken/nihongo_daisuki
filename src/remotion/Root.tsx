import React from "react";
import { Composition } from "remotion";
import { WordVideo, WordVideoProps, wordVideoDurationInFrames } from "./compositions/WordVideo";
import { fetchRandomQuestions, fetchQuestions } from "./lib/fetchQuestion";

export const Root: React.FC = () => {
  return (
    <Composition
      id="WordVideo"
      component={WordVideo}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        questions: [],
        questionIds: [] as string[],
      }}
      calculateMetadata={async ({ props }) => {
        // questionsが渡されていればそのまま使用（GitHub Actions環境）
        // 渡されていなければSupabaseから取得（ローカルプレビュー用）
        const questions = props.questions.length > 0
          ? props.questions
          : props.questionIds.length > 0
            ? await fetchQuestions(props.questionIds)
            : await fetchRandomQuestions(5);
        return {
          props: { ...props, questions },
          durationInFrames: wordVideoDurationInFrames(questions),
        };
      }}
    />
  );
};
