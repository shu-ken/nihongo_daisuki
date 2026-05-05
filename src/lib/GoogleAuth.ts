import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import http from "http";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const TOKEN_PATH = path.join(process.cwd(), "config", "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "config", "credentials.json");

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export class GoogleAuth {
  private oauth2Client: OAuth2Client | null = null;

  /**
   * 認証クライアントを返す。
   * - CI環境: YOUTUBE_OAUTH_TOKEN_JSON 環境変数からトークンを読み込む
   * - ローカル: config/token.json を使用（なければブラウザ認証フロー）
   */
  async getAuthClient(): Promise<OAuth2Client> {
    if (this.oauth2Client) return this.oauth2Client;

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET が未設定です");
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:3000");

    oauth2Client.on("tokens", (tokens) => {
      if (fs.existsSync(TOKEN_PATH)) {
        const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
        fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...tokens }));
      }
    });

    const token = this.loadToken();
    oauth2Client.setCredentials(token);

    this.oauth2Client = oauth2Client;
    return oauth2Client;
  }

  private loadToken(): object {
    // CI: 環境変数から読み込む
    if (process.env.YOUTUBE_OAUTH_TOKEN_JSON) {
      return JSON.parse(process.env.YOUTUBE_OAUTH_TOKEN_JSON);
    }

    // ローカル: config/token.json から読み込む
    if (fs.existsSync(TOKEN_PATH)) {
      return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
    }

    throw new Error(
      "YouTubeトークンが見つかりません。\n" +
      "ローカル: npm run reauth を実行してください\n" +
      "CI: YOUTUBE_OAUTH_TOKEN_JSON を Secrets に登録してください"
    );
  }

  /** ローカル用: ブラウザ認証フローでtoken.jsonを生成する */
  async reauth(): Promise<void> {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      throw new Error(`credentials.json が見つかりません: ${CREDENTIALS_PATH}`);
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
    const { client_id, client_secret } = credentials.installed ?? credentials.web;

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:3000");

    const authUrl = oauth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });

    const token = await new Promise<object>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.url?.startsWith("/?code=")) return;

        const code = new URL(req.url, "http://localhost:3000").searchParams.get("code");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>✅ 認証成功！このウィンドウを閉じてください。</h1>");

        try {
          const { tokens } = await oauth2Client.getToken(code!);
          server.close();
          resolve(tokens);
        } catch (e) {
          server.close();
          reject(e);
        }
      }).listen(3000, async () => {
        console.log("📝 ブラウザで認証してください:");
        console.log(authUrl);
        try { await execAsync(`open "${authUrl}"`); } catch { /* no-op */ }
      });

      setTimeout(() => { server.close(); reject(new Error("認証タイムアウト")); }, 5 * 60 * 1000);
    });

    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    console.log(`✅ token.json を保存しました: ${TOKEN_PATH}`);
    console.log("👉 この内容を GitHub Secrets の YOUTUBE_OAUTH_TOKEN_JSON に登録してください");
  }
}
