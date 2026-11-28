# 制作と書き出し

> **優先順位**：見た目・カメラ・音・確認は `cartoon-3d-short` スキル（Mr omi 氏）に従う。この資料と食い違う所は、そちらを優先する。

## フォルダ
```
src/videos/<名前>/          動画のコード（src/videos/bridge/ をコピーして始める）。src/Root.tsx に登録
src/lib/                    共通部品（SyncComposer・Captions・faceRig・shotLint・contextGuard）
episodes/<名前>/
  ├─ media/voice.wav        ナレーション
  ├─ media/mix.wav          声・音楽・効果音を混ぜたもの（書き出しの --audio）
  └─ data/                  words.json・subs.json など（コードから読む）
public/<名前>/              その動画の絵・モデル（大きい物は Git に入れない）
out/<名前>/
  ├─ check/                 静止画・比較画像（試し。いつ消してもよい）
  ├─ look/                  見た目の計測結果
  ├─ qa/v<番号>/            全フレームの確認結果
  └─ final/<名前>_v<番号>.mp4
```

## 手順
1. `cp -r src/videos/bridge src/videos/<名前>`、和の場面なら `.claude/skills/anime-short/templates/japan/` の部品で上書き。`src/Root.tsx` に登録する。
2. 台本の文ごとに見せ場の型（`climax-playbook.md`）を当て、`story.ts` にカット表とカメラを書く。人物の配置と演技は `cast.ts`。
3. カットの点検 → 静止画 → 直す、をカットごとに回す。
4. 音を作る（cartoon-3d-short の `templates/audio/`）→ 書き出し → 全フレームの確認。

## コマンド（リポジトリの一番上で）
```
npx remotion studio src/index.ts                                            # プレビュー
node scripts/shot_lint.mjs <名前>Lint out/<名前>/check/lint.md              # カットの点検。静止画の前に必ず
COMP=<コンポジション名> node scripts/bridge-stills.mjs out/<名前>/check/x_ 100,400 0.5   # 静止画
python scripts/look_check.py --ours out/<名前>/check/x_100.jpg ... --ref-frames <参考のコマ>/*.jpg   # 見た目の計測
python scripts/sbs_sheet.py out.jpg --ours ... --ref ...                    # 参考と並べた比較画像
node scripts/render-short.mjs <コンポジション名> out/<名前>/final/<名前>_v1.mp4 --audio episodes/<名前>/media/mix.wav
python scripts/short_qa.py out/<名前>/final/<名前>_v1.mp4 out/<名前>/qa/v1    # 全フレームと音の確認
python scripts/lipsync.py --eleven <声>.alignment.json src/videos/<名前>/vis.json   # 口の形（セリフに合わせる。時刻がなければ --whisper <声.wav>）
npx tsc -p .
```

`<名前>Lint` は、その動画のカット点検用コンポジション（`src/lib/shotLint.tsx` を使って作り、Root.tsx に登録する）。

## 書き出しの道具（`scripts/render-short.mjs`）
- 素材のまとめ（バンドル）は1回だけ作り、ソースと public が変わらない限り `out/.bundle-cache/` から使い回す。
- ブラウザは1つを使い回す。止まったら90秒で打ち切ってやり直す。白・黒のフレームを自動で検査する。途中から再開できる。
- タブの数は空きメモリで決める。内蔵 GPU の PC では1タブの方が速い。
- 成功すると、音なし版と途中のかけらは自動で消える（`--keep-work` で残す）。
- Remotion のまとめは `public/` を一時フォルダにコピーする。容量の大きいドライブに `REMOTION_TMP` を向けておく。

## 借りた GPU で書き出す（任意）
vast.ai などで GPU を借りて書き出す道具が `scripts/remote/` にある（手順は `scripts/remote/README.md`）。起動と借りるのはお金がかかるので、毎回作る人の「はい」をもらってから。終わったらすぐ止めて返す。

## 書き出しが遅い・白くなるときの原因と対策（作者の PC で測ったもの）
作者の PC（参考）：Ryzen 7 7735U（8コア16スレッド）、内蔵GPU（Radeon）、メモリ15GB。
- **メモリ不足**：空きが2〜3GBだと Chrome が落ちる／GPU が WebGL を失って**真っ白な絵を黙って書き出す**／フレーム0で止まったままになる。
  → `src/lib/contextGuard.ts`：GPU が落ちたら、その場で失敗にしてやり直させる。`render-short.mjs` の打ち切りと白・黒の検査。
- 重ね合わせ（クロスフェード）のたびに世界を作り直すとメモリを圧迫する → 世界は枠ごとに1回だけ作って使い回す。
- 重い処理は1つずつ（`scripts/heavy.mjs` の鍵）。同時に走らせても速くならない。2タブは遅いうえ空きメモリが尽きる。
- 3D は Vulkan で描く（Direct3D11 より速かった）。GPU エンコード（h264_amf）は画質が落ちるので本番には使わない。
