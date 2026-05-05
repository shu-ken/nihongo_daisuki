import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { Question, RendererConfig } from "../types";

export class RemotionRenderer {
  constructor(private config: RendererConfig) {}

  static fromProjectRoot(projectRoot: string): RemotionRenderer {
    return new RemotionRenderer({
      projectRoot,
      remotionEntry: path.join(projectRoot, "src/remotion/index.tsx"),
      compositionId: "WordVideo",
      outputDir: path.join(projectRoot, "output/videos"),
    });
  }

  render(questions: Question[], outputVideoPath: string): void {
    fs.mkdirSync(path.dirname(outputVideoPath), { recursive: true });

    // シェルのクォート問題を避けるためpropsをファイル経由で渡す
    const propsPath = path.join(this.config.projectRoot, "output", "props.json");
    fs.mkdirSync(path.dirname(propsPath), { recursive: true });
    fs.writeFileSync(propsPath, JSON.stringify({
      questionIds: questions.map((q) => q.id),
      questions,
    }));

    const cmd = [
      "npx remotion render",
      `"${this.config.remotionEntry}"`,
      this.config.compositionId,
      `"${outputVideoPath}"`,
      `--props="${propsPath}"`,
      `--config="${path.join(this.config.projectRoot, "remotion.config.ts")}"`,
    ].join(" ");

    execSync(cmd, { stdio: "inherit", cwd: this.config.projectRoot });

    fs.unlinkSync(propsPath);
  }

  buildOutputPath(date: string, edition: string): string {
    const dir = path.join(
      this.config.outputDir,
      date,
      `long-${edition.toLowerCase()}`,
      "mp4"
    );
    return path.join(dir, `long_${edition.toLowerCase()}.mp4`);
  }
}
