import React from "react";
import { Composition } from "remotion";
import { WordVideo, wordVideoDurationInFrames } from "./compositions/WordVideo";
import { WordShort, wordShortDurationInFrames } from "./compositions/WordShort";
import { fetchRandomQuestions, fetchQuestions, fetchQuestion } from "./lib/fetchQuestion";

export const Root: React.FC = () => {
  return (
    <>
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
      <Composition
        id="WordShort"
        component={WordShort}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          question: null,
          questionId: "",
        }}
        calculateMetadata={async ({ props }) => {
          const question = props.question ?? await fetchQuestion(props.questionId);
          return {
            props: { ...props, question },
            durationInFrames: wordShortDurationInFrames(question),
          };
        }}
      />
    </>
  );
};
