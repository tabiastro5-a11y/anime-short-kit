# 日本語アニメショート・キット（AI動画のレシピ）

2Dの人物を3Dの世界に置いた、日本語の縦型アニメショート（1080×1920）を、Claude Code に作ってもらうためのキットです。
three.js と Remotion で、自分の PC の上で描きます（AI の動画生成は使いません）。

**このキットが受け持つのは「台本と声ができたあと、それをアニメの動画にする所」だけです。**
台本・ナレーションの声・タイトルは、自分で用意してください。物語・人物・声は、必ず自分のものを使ってください。

## 中身
| 場所 | 中身 |
|---|---|
| `.claude/skills/cartoon-3d-short/` | 土台のスキル（MIT）。見た目・カメラ・人物・仕上げ・音・確認の手順 |
| `.claude/skills/anime-short/` | 日本語化と、こちらで足した部分の決まり：和の世界と人物の部品、顔の動かし方、見せ場の撮り方、よくある失敗と直し方、書き出しの手順 |
| `src/videos/bridge/` | 見本の動画（元のスキルの「橋」のショート）。新しい動画はこれをコピーして始める |
| `src/lib/` | 共通部品：`SyncComposer`（静止画が背景色だけになる問題の回避）、`Captions`（日本語の字幕）、`faceRig`（目・眉・口をコードで描いて動かす顔リグ）、`shotLint`（カットの点検）、`contextGuard`（GPU が落ちたら白い絵を出さずに止める） |
| `scripts/` | 静止画、カットの点検、見た目の計測、比較画像、書き出し（再開・自動検査つき）、全フレームの確認、人物の絵の切り分け、モデルの縮小、借りた GPU での書き出し（任意） |

## 用意する物
- Node.js 20 以上、Python 3.10 以上、ffmpeg
- Claude Code
- 3D素材（自分で入手。Git には入れない）：見本の「橋」は [Kenney](https://kenney.nl/assets)（CC0）の **Nature Kit** と **Fantasy Town Kit** のモデルを `public/bridge/kenney/` に `.glb` で置いて使います。使うファイル名の一覧は `src/videos/bridge/world.ts` の `KENNEY` です。無いモデルは飛ばして描くので、置かなくても見本は動きます（木や屋台が減るだけ）。

## はじめかた
```
npm install
npx tsc -p .
npx remotion studio src/index.ts
```
プレビューで `BridgeShort` が見えれば準備完了です。

Claude Code でこのフォルダを開き、次のように頼みます：
> anime-short と cartoon-3d-short のスキルを使って、`episodes/<名前>/` の台本と声をアニメにして

用意しておくもの（`episodes/<名前>/`）：
- `media/voice.wav` … ナレーション
- `data/words.json` … 単語（日本語は文節）ごとの時刻
- 台本 … どの文で何を見せるか分かるもの
- （字幕を入れるなら）`data/subs.json`

詳しい手順とコマンドは `.claude/skills/anime-short/references/production.md` にあります。

## 注意
- 書き出しは重い処理です。PC で1つずつ動かしてください（道具が自動で順番待ちします）。
- Remotion は書き出しのたびに `public/` を一時フォルダにコピーします。容量の大きいドライブに `REMOTION_TMP` を向けておくと安全です。
- CC-BY の3D素材を使ったら、動画の説明欄に作者表記を入れてください。

## ライセンス
- `.claude/skills/cartoon-3d-short/` と `src/videos/bridge/`：Mr omi 氏、MIT License（`.claude/skills/cartoon-3d-short/LICENSE`）
- それ以外：AI動画のレシピ、MIT License（`LICENSE`）
