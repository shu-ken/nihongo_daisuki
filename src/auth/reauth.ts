import "dotenv/config";
import { GoogleAuth } from "../lib/GoogleAuth";

async function main() {
  const auth = new GoogleAuth();
  await auth.reauth();
}

main().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
