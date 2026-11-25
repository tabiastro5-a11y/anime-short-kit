# 日本語アニメショート・キット

台本と声ができた日本語の縦型ショートを、2Dの人物を3Dの世界に置いたアニメ（1080×1920）にするためのリポジトリ。

- **作り方の本体は `cartoon-3d-short` スキル**（`.claude/skills/cartoon-3d-short/`、Mr omi 氏、MIT）。見た目・カメラ・人物・仕上げ・音・確認はすべてこれに従う。
- **日本語化とアニメ作りの追加は `anime-short` スキル**。両方を読み込んでから作業する。食い違ったら cartoon-3d-short を優先する。
- 台本・声・タイトルはこのキットの範囲外。作る人が用意した物を使う。

## フォルダ
- `src/videos/<名前>/` … 動画のコード（`src/videos/bridge/` をコピーして始める）。`src/Root.tsx` に登録。
- `src/lib/` … 共通部品（SyncComposer・Captions・faceRig・shotLint・contextGuard）
- `scripts/` … 静止画・点検・計測・書き出し・確認の道具
- `episodes/<名前>/` … その動画の声・音・データ（`media/`、`data/`）
- `public/` … 絵とモデル（大きい物は Git に入れない）
- `out/<名前>/` … `check/`（試し）、`look/`（見た目の計測）、`qa/v<番号>/`（全フレームの確認）、`final/`（完成品）

## 決まり
- 3Dの素材は自作より先に入手を考える。足りない物は「何が・なぜ・候補の入手先」を作る人に伝えて取ってきてもらう。
- 静止画の前に必ずカットの点検（`scripts/shot_lint.mjs`）。
- 3Dの画面を持つコンポジションには `src/lib/contextGuard.ts` の `useContextGuard()` を入れる。
- 重い処理（書き出し・静止画・全フレームの確認・音の生成）は1つずつ。同じ鍵（`out/.heavy.lock`）を取ってから動く。
- 書き出しは `scripts/render-short.mjs` を使う。`npx remotion render` を直接使わない。
- 借りた GPU（`scripts/remote/`）を使うときは、起動・借りる前に値段を添えて作る人の「はい」をもらう。終わったらすぐ止める。
- 声・動画・`out/`・3D素材は Git に入れない。キー類はリポジトリに置かず、値を画面に出さない。

## よく使うコマンド（リポジトリの一番上で）
```
npx remotion studio src/index.ts
node scripts/shot_lint.mjs <名前>Lint out/<名前>/check/lint.md
COMP=<コンポジション名> node scripts/bridge-stills.mjs out/<名前>/check/x_ 100,400 0.5
node scripts/render-short.mjs <コンポジション名> out/<名前>/final/<名前>_v1.mp4 --audio episodes/<名前>/media/mix.wav
python scripts/short_qa.py out/<名前>/final/<名前>_v1.mp4 out/<名前>/qa/v1
npx tsc -p .
```
