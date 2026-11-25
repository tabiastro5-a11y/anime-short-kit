// Studio captions (shared by every video): one 文節 at a time, bold white with a dark outline, centred at ~70 % of the
// height (measured on the reference: one word at a time, white bold, black outline, ~70 %). Numbers with a counter word
// turn accent yellow when the chunk is marked accent. Pixel sizes scale with the output width.
// Chunks come from the episode's data/subs.json ({ text, start, end, hold, accent }, seconds of narration).
import { loadFont as loadDela } from "@remotion/google-fonts/DelaGothicOne";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const dela = loadDela("normal", { weights: ["400"], subsets: ["japanese", "latin"], ignoreTooManyRequestsWarning: true } as never);
export const FONT = dela.fontFamily;


export type Chunk = { text: string; start: number; end: number; hold: number; accent: boolean };
const NUM = /([0-9〇一二三四五六七八九十百千万]+(?:人|歳|年|メートル|年後))/;
export const ACCENT = "#ffd23f";
const INK = "#1b1426";

/** offset: seconds of narration at frame 0 of this composition */
export const Captions: React.FC<{ chunks: Chunk[]; offset?: number; y?: number }> = ({ chunks, offset = 0, y = 0.7 }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps + offset;
  const c = chunks.find((k) => t >= k.start && t < k.hold);
  if (!c) return null;
  const age = (t - c.start) * fps;            // frames since this chunk appeared
  const pop = interpolate(age, [0, 2, 5], [0.82, 1.06, 1], { extrapolateRight: "clamp" });
  const size = Math.round(width * (c.text.length > 9 ? 0.074 : 0.088));
  const parts = c.text.split(NUM);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", left: 0, right: 0, top: `${y * 100}%`, transform: `translateY(-50%) scale(${pop})`,
        textAlign: "center", fontFamily: FONT, fontSize: size, lineHeight: 1.15, color: "#f6f2e8", letterSpacing: "0.02em",
        WebkitTextStroke: `${Math.round(size * 0.16)}px ${INK}`, paintOrder: "stroke fill",
        textShadow: `0 ${Math.round(size * 0.07)}px 0 ${INK}`,
      }}>
        {parts.map((p, i) => <span key={i} style={{ color: NUM.test(p) && c.accent ? ACCENT : "#f6f2e8" }}>{p}</span>)}
      </div>
    </AbsoluteFill>
  );
};

