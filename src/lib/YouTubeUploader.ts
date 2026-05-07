import { google, youtube_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import { UploadOptions } from "../types";

export class YouTubeUploader {
  private youtube: youtube_v3.Youtube;

  constructor(auth: OAuth2Client) {
    this.youtube = google.youtube({ version: "v3", auth });
  }

  async upload(videoPath: string, options: UploadOptions): Promise<string> {
    console.log(`📤 アップロード中: ${path.basename(videoPath)}`);
    console.log(`   タイトル: ${options.title}`);

    const fileSizeMB = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(2);
    console.log(`   サイズ: ${fileSizeMB} MB`);

    try {
      const response = await this.youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: options.title,
            description: options.description,
            tags: options.tags,
            categoryId: "27", // Education
          },
          status: {
            privacyStatus: options.publishAt ? "private" : options.privacyStatus,
            madeForKids: options.madeForKids,
            selfDeclaredMadeForKids: options.madeForKids,
            publishAt: options.publishAt,
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      const videoId = response.data.id ?? "";
      console.log(`✅ 完了: https://www.youtube.com/watch?v=${videoId}`);
      return videoId;
    } catch (error: any) {
      const msg: string = error?.response?.data?.error?.message ?? error.message ?? String(error);
      console.error(`❌ アップロードエラー: ${msg}`);

      const status = error?.response?.status ?? error?.code;
      if (status === 401 || status === 403) {
        console.error("💡 認証エラー: npm run reauth を実行してください");
      }

      if (msg.includes("The user has exceeded the number of videos they may upload")) {
        const e: any = new Error(msg);
        e.code = "UPLOAD_LIMIT_EXCEEDED";
        throw e;
      }

      throw error;
    }
  }
}
