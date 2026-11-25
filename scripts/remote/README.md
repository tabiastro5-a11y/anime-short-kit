# GPU を借りて書き出す（vast.ai など）

書き出し（`render-short.mjs`）と、まとめて撮る静止画（`bridge-stills.mjs`）だけを、借りた Linux の GPU マシンで動かす。
音・確認（QA）・少しの静止画はこの PC のまま。

## 1. 借りる（ユーザーが行う：アカウント・支払い）
1. vast.ai にアカウントを作り、少額をチャージする。
2. **SSH の鍵を登録**：この PC で一度だけ
   ```
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
   ```
   表示された `~/.ssh/id_ed25519.pub` の中身を vast.ai の「Account → SSH Keys」に貼る（秘密鍵 `id_ed25519` は渡さない）。
3. 「Templates」で **Ubuntu 22.04 系の CUDA イメージ**（例：`nvidia/cuda:12.4.1-runtime-ubuntu22.04`）を選び、**Docker options に次を入れる**（これが無いと Chrome が GPU を使えない）：
   ```
   -e NVIDIA_DRIVER_CAPABILITIES=all
   ```
   起動方式は SSH。ディスクは 30 GB あれば足りる。
4. 「Search」で **RTX 4090 か 3090 / 1台 / メモリ 32 GB 以上 / ネット速度の速いもの** を選んで借りる（目安 1時間 数十円〜100円前後）。
5. 借りたマシンの「Connect」に出る `ssh -p ポート root@IPアドレス` の **ポートと IP** を控える。

## 2. この PC に接続先を書く（Git には入らない）
リポジトリの一番上に `.remote-render.env` を作る：
```
RR_HOST=IPアドレス
RR_PORT=ポート
RR_USER=root
RR_DIR=/root/anime
RR_CONC=4
```

## 3. 初回の準備（マシンごとに1回、10〜15分）
```
bash scripts/remote/remote.sh setup
```
- コード・3Dモデル・回のデータを送り、Node・ffmpeg・Chrome の部品・パッケージを入れる。
- `vulkan` → `angle-egl` → `egl` の順に試し、**WebGL がハードウェアで動いた方式**を `scripts/remote/gpu.env` に書く。
- どれも動かない時は「`NVIDIA_DRIVER_CAPABILITIES=all` が入っていない」ことが多い（1-3 を確認して借り直す）。

## 4. 使う（1本 約2〜3分：送る・8つ並べて書き出す（64秒の動画で約76秒）・受け取る）
```
bash scripts/remote/remote.sh render MyShort out/my/final/my_v1.mp4 --audio episodes/<名前>/media/mix.wav
bash scripts/remote/remote.sh stills OtoriShort out/otori/check/s_ 10,80,190,309 0.5
```
- 毎回、変わったコードとデータを送ってから書き出し、出来た動画・静止画をこの PC の同じ場所に持ってくる。
- 同時に動かす数は `RR_CONC`（4090 なら 4 から試す）。
- 出来た動画の確認（`short_qa.py`）はこの PC で行う。

## 5. 最初の1回だけ：見た目が同じか確かめる
GPU の種類が変わると、絵がわずかに変わることがある。同じコマを両方で撮って並べる：
```
COMP=OtoriShort node scripts/bridge-stills.mjs out/otori/check/gpu_local_ 190,1023,1896 0.5
bash scripts/remote/remote.sh stills OtoriShort out/otori/check/gpu_remote_ 190,1023,1896 0.5
python scripts/sbs_sheet.py out/otori/check/gpu_cmp.jpg --ours out/otori/check/gpu_remote_190.jpg out/otori/check/gpu_remote_1023.jpg out/otori/check/gpu_remote_1896.jpg --ref out/otori/check/gpu_local_190.jpg out/otori/check/gpu_local_1023.jpg out/otori/check/gpu_local_1896.jpg
```

## 6. いつもの流れ（借りたあと：書き出しのたびにオン、終わったらオフ）
| いつ | Claude がすること | お金 |
|---|---|---|
| 書き出しが必要になった | **値段を添えて「GPU を起動します（$0.4/時）。よいですか？」と聞く** → はいで `remote.sh up`（止めていたマシンを起動） | **ここからかかる** |
| 起動したら | `remote.sh render ...`（全体）または `remote.sh redo ... <a-b>`（直した所だけ）、静止画は `stills` | かかる |
| 終わったらすぐ | `remote.sh down`（**停止**。設定は残る）。確認：`remote.sh state` | GPU 代は止まる（ディスク代だけ 1日数円〜十数円） |
| しばらく使わない | `remote.sh done`（**返却**）。次は借り直しと準備から | すべて止まる |
| 初めて／返却したあと | `remote.sh offers` で条件に合う安い順の5つを見せ、**選んでもらってから** `remote.sh rent <id>`（借りて準備まで自動） | ここからかかる |

- **起動と借りるのは、お金がかかり始める操作なので、毎回ユーザーの「はい」をもらってから**（安全上の決まり。ボタン1つで済むように聞く）。停止・返却は聞かずにすぐ行う。
- **保険**：借りたマシンは、20分なにも動かなければ自分で**停止**する（`idle-return.sh`。vast.ai がマシンごとに入れる専用キーを使うので、アカウントのキーはマシンに送らない）。
- 停止中のマシンは、ほかの人が使っていると起動できないことがある（その時は `offers` → `rent` で別のマシン）。
- キーは `~/.tts_keys.env` の `VAST_API_KEY`（表示しない・送らない）。

## 7. 直した所だけ書き出す（redo）
- 全体を書き出すと、8つの部分（`<動画>_parts/p0〜p7.mp4` と `ranges.txt`）がこの PC に残る。
- 直したら、変わったフレームの範囲だけ：
  ```
  bash scripts/remote/remote.sh redo MyShort out/my/final/my_v2.mp4 1000-1100 --audio episodes/<名前>/media/mix.wav
  bash scripts/remote/remote.sh redo-local OtoriShort out/otori/final/otori_v3.mp4 1000-1100 --audio ...   # GPU を借りずにこの PC で
  ```
  その範囲にかかる部分だけを書き直し、この PC で残りとつないで音を付ける（絵は再圧縮しないので劣化しない）。
- 音（mix.wav）だけ変えた時は、書き出さずにつなぎ直すだけ：`bash scripts/remote/join-parts.sh out/otori/final/otori_v3_parts out/otori/final/otori_v3.mp4 <mix.wav>`
- 時刻（カットの長さ・声）が変わったら、全体を書き出し直す（部分の範囲がずれるため）。

## 送らないもの
参考動画、`assets/`、API キー（`~/.tts_keys.env`）、`.git`、`out/`。送るのは `remote.sh` の `send()` に書いたものだけ。
