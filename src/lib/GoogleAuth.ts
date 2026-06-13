import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import http from "http";
import readline from "readline";

const TOKEN_PATH = path.join(process.cwd(), "config", "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "config", "credentials.json");
const REDIRECT_URI = "http://localhost:3000";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
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

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

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

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    // ローカルサーバーを起動しつつ、リダイレクト失敗時は手動入力も受け付ける
    const token = await new Promise<object>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        if (!req.url?.includes("code=")) return;

        const code = new URL(req.url, REDIRECT_URI).searchParams.get("code");
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
      });

      server.listen(3000, () => {
        console.log("✅ ローカルサーバー起動済み (port 3000)");
        console.log("\n📝 以下のURLをブラウザで開いて認証してください:");
        console.log(authUrl);
        console.log("\n認証後にブラウザが localhost:3000 に自動リダイレクトされます。");
        console.log("リダイレクトが失敗した場合は、ブラウザのアドレスバーのURLをここに貼り付けてEnterを押してください:");
        console.log("（自動成功した場合は何も入力不要です）\n");
      });

      // 手動入力のフォールバック
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.on("line", async (input) => {
        const trimmed = input.trim();
        if (!trimmed.includes("code=")) return;
        try {
          const code = new URL(trimmed).searchParams.get("code");
          const { tokens } = await oauth2Client.getToken(code!);
          rl.close();
          server.close();
          resolve(tokens);
        } catch (e) {
          rl.close();
          server.close();
          reject(e);
        }
      });

      setTimeout(() => { server.close(); rl.close(); reject(new Error("認証タイムアウト（5分）")); }, 5 * 60 * 1000);
    });

    fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    console.log(`\n✅ token.json を保存しました: ${TOKEN_PATH}`);
    console.log("👉 この内容を GitHub Secrets の YOUTUBE_OAUTH_TOKEN_JSON に登録してください:");
    console.log(JSON.stringify(token));
  }
}
