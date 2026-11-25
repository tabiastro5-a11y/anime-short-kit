// Fail the render at once when the GPU drops the WebGL context (out of GPU / system memory), instead of silently
// writing white frames for the rest of the chunk. scripts/render-short.mjs then retries that chunk.
// Use inside any <ThreeCanvas> child: useContextGuard();
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { cancelRender } from "remotion";

export const useContextGuard = () => {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let alive = true;
    const el = gl.domElement;
    const lost = () => { if (alive) cancelRender(new Error("WebGL context lost (GPU or system memory ran out)")); };
    el.addEventListener("webglcontextlost", lost);
    return () => { alive = false; el.removeEventListener("webglcontextlost", lost); };
  }, [gl]);
};
