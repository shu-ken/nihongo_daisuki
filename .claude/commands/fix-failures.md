# GitHub Actions 失敗ログ取得・分析・修正

以下の手順を順番に実行してください。

## ステップ1: 未取得の失敗ログをダウンロード

`log/` ディレクトリに保存済みのrun IDを `log/.saved_run_ids` で管理する。
未保存の失敗runのログを取得して `log/` に保存する。

```bash
mkdir -p log
touch log/.saved_run_ids

gh run list \
  --limit 20 \
  --status failure \
  --json databaseId,workflowName,createdAt \
  --jq '.[]' \
| while IFS= read -r run; do
  RUN_ID=$(echo "$run" | jq -r '.databaseId')
  WORKFLOW=$(echo "$run" | jq -r '.workflowName')
  CREATED_AT=$(echo "$run" | jq -r '.createdAt')
  DATE=$(echo "$CREATED_AT" | cut -c1-10)

  if grep -qxF "$RUN_ID" log/.saved_run_ids; then
    continue
  fi

  SLUG=$(echo "$WORKFLOW" | iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null | tr -cs '[:alnum:]' '-' | sed 's/^-*//;s/-*$//')
  FILENAME="${DATE}_${SLUG}_${RUN_ID}.txt"
  gh run view "$RUN_ID" --log > "log/$FILENAME" 2>&1 || true
  echo "$RUN_ID" >> log/.saved_run_ids
  echo "保存: $FILENAME"
done
```

## ステップ2: ログを分析

`log/` 内の `.txt` ファイルをすべて読んでエラーの根本原因を特定する。
同じ原因が複数ある場合はまとめて1つの修正として扱う。

## ステップ3: コードを修正

`src/` 配下の該当コードを修正する。
- TypeScriptの型エラーが出ないよう注意する
- 既存のコードスタイルに合わせる
- 修正が不要・原因不明の場合はユーザーに報告して終了する

## ステップ4: 修正をpush

```bash
git add src/
git commit -m "自動修正: GitHub Actions失敗ログを元にコードを修正"
git push
```

## ステップ5: ログを削除

修正のpushが成功したらログファイルを削除する。

```bash
rm -f log/*.txt
```

`.saved_run_ids` は残す（重複取得防止のため）。

## 完了報告

修正内容と削除したログファイル数をユーザーに報告する。
