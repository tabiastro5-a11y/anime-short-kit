---
name: anime-short
description: 日本語の縦型アニメショート（2Dの人物を3Dの世界に置く）の「アニメを作る部分」の決まりと部品。cartoon-3d-short スキルの上に、和の世界と人物・顔の動き（顔リグ）・見せ場の撮り方・字幕・書き出しと確認の道具を足す。台本と声はできている前提で、それを3Dアニメの動画にするときに使う。「アニメにして」「この台本と声で動画を作って」「和の場面を作って」と言われたとき、カット・人物・表情・カメラ・書き出しを扱うときに使う。必ず cartoon-3d-short と一緒に使う。
---

# 日本語アニメショート（アニメを作る部分）

**作り方の本体は `cartoon-3d-short` スキル（Mr omi 氏、MIT）。** 見た目の数値・カメラ・人物・仕上げ・音・確認は、すべてそちらに従う。このスキルと食い違ったら **cartoon-3d-short を優先する**。

このスキルが受け持つのは、**台本と声ができたあと、それを3Dアニメの動画にする所だけ**。
台本・声・タイトルは作る人が自分で用意する（このスキルには入っていない）。物語・人物・声は必ず自分のものを使う。

## 0. 始める前にそろえる物
`episodes/<名前>/` に置く：
- `media/voice.wav`（ナレーション）と、単語（日本語は文節）ごとの時刻 `data/words.json`（cartoon-3d-short の手順と同じ形）
- 字幕を入れるなら `data/subs.json`（`{ text, start, end, hold, accent }` の並び、秒）
- 台本（どの文で何を見せるか分かるもの）

## 1. cartoon-3d-short の決まりとの違い
| 彼の決まり | このスキル |
|---|---|
| English only | **日本語**（画面の文字も日本語） |
| No captions or labels in the video | **字幕を入れてよい**：文節ごと・白い太字・黒いふち・高さ約70%。`src/lib/Captions.tsx` + `data/subs.json`。名札などその他の文字は入れない |
| Final export 2K 1440x2560 | **1080x1920**（`--scale` なしで書き出す） |

## 2. 和の世界と人物
- 彼の世界（`build.ts` / `paint.ts` / `world.ts`）と人物（`toon.ts` / `cast.ts`）の作りに、和の部品を足してある：茅葺きの民家、瓦の町家、蔵、田んぼとあぜ、稲むら、神社と鳥居、石段、海と石垣、松、堤防。和装（ちょんまげ・日本髪・手ぬぐい・着物と帯・野良着）と作業の動き。
- **部品の目録は `references/parts.md`**。新しい動画は `src/videos/bridge/` をコピーしてから、`templates/japan/` の部品で上書きする（`templates/japan/` は試作の回「稲むらの火」のもの。カット表と配役は回ごとに書き直す）。
- **3Dの素材が必要になったら、質の低いモデルを自作しない**。「何が・なぜ必要か・候補の入手先（Kenney など CC0 を優先）」を作る人に伝えて取ってきてもらう。届いたら中身を確かめてから `public/` に置く（大きい物は `scripts/glb_shrink.py` で縮める）。コードで作るのは、形が単純で質を落とさないもの（地面・水面・空・簡単な板や箱）だけ。CC-BY の素材は説明欄に作者表記が要る。

## 3. 人物の絵と顔の動き
- **人物の絵は ChatGPT などで作る（顔の部品のない頭と、胴＝服）。腕・脚・目・眉・口はコードで描いて動かす**：指示文は `references/character-prompts.md`、切り分けは `scripts/slice_character.py`。
- **顔の動かし方は `references/face-rig.md`** と顔リグ `src/lib/faceRig.ts`。目は別の目に一瞬で替わる、眉と口は別々の部品として変形・移動する。口はセリフに合わせて動かす（`scripts/lipsync.py` で読みの母音の口の形 `vis.json` を作り、`faceAt` に渡す。前後のコマと混ぜてなめらかに変わる）。

## 4. カットと見せ場
- **見せ場の撮り方は `references/climax-playbook.md`**：つかみ・紹介・決意・驚き・災害・怒り・オチなど場面の型ごとに、寄り方・角度・演技・記号・間を決めてある。カットを設計する前に、台本の文ごとに型を当てはめる。
- カットの文法は `references/shot-grammar.md`、見た目の数値の補足は `references/visual-rules.md`（伸びている海外の解説型ショート24本を測った記録。彼のレポートと食い違う数値は彼の方に従う）。
- **カットは少なく、1カットの中でカメラと人物を動かす**。参考の動画のカットの刻み方をまねない。

## 5. 作る・確かめる・書き出す
- 手順とコマンドは `references/production.md`。
- **作り始める前に `references/mistakes.md` と `references/build-lessons.md` を読む**（よくある失敗と、技術的な不具合の直し方。新しく見つけたら足す）。
- 静止画の前に必ずカットの点検（`scripts/shot_lint.mjs`：カメラのめり込み・向き・映り込み・抜け）。
- 3Dの画面を持つコンポジションには `src/lib/contextGuard.ts` の `useContextGuard()` を入れる（GPU が落ちたら白い絵を出さずに止める）。

## 6. この環境での注意（彼のスキルに無いもの）
- `@react-three/postprocessing` 3.x の `<EffectComposer>` は最初のフレームで何も描かず、Remotion の静止画が背景色だけになる。**`src/lib/SyncComposer.tsx` を使う**（同じ工程・同じ順番）。新しい動画のコピーでも同じ置き換えをする。
- 書き出しは PC に1つずつ。重い処理（書き出し・静止画・全フレームの確認）は同じ鍵（`out/.heavy.lock`）を取ってから動く。
- 書き出しは `scripts/render-short.mjs` を使い、`npx remotion render` を直接使わない。
