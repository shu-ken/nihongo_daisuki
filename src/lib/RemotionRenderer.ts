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

    const props = JSON.stringify({
      questionIds: questions.map((q) => q.id),
      questions,
    });

    const cmd = [
      "npx remotion render",
      `"${this.config.remotionEntry}"`,
      this.config.compositionId,
      `"${outputVideoPath}"`,
      `--props='${props}'`,
      `--config="${path.join(this.config.projectRoot, "remotion.config.ts")}"`,
    ].join(" ");

    execSync(cmd, { stdio: "inherit", cwd: this.config.projectRoot });
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
