// Drop-in for @react-three/postprocessing's <EffectComposer> that works with Remotion stills.
//
// Why: @react-three/postprocessing 3.x creates its composer in an effect and stores it in React state, so the very
// first frame renders nothing (and the priority-1 useFrame also stops R3F's default render). Remotion renders a
// still as a single frame, so every still came out as the bare background. This version builds the composer
// synchronously (useMemo) and renders it in the same frame.
//
// Same semantics as the original (v3.2.2 buildPasses, mergeMode "auto"): a RenderPass first, then the given objects
// in order; consecutive Effects are merged into one EffectPass unless that would put two convolution effects (or a
// convolution effect and an effect that reads mainUv) in the same pass; Passes are added as they are. Like the
// original, the renderer's own tone mapping is switched off (the ToneMappingEffect does it).
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Effect, EffectComposer, EffectPass, Pass, RenderPass } from "postprocessing";

export const SyncComposer: React.FC<{ passes: (Effect | Pass | null | false | undefined)[]; multisampling?: number }> = ({ passes, multisampling = 4 }) => {
  const { gl, scene, camera, size } = useThree();
  const list = passes.filter(Boolean) as (Effect | Pass)[];
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { multisampling, frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    const isConv = (e: Effect) => (e.getAttributes() & 2) === 2;
    const mainUv = (e: Effect) => /mainUv/.test(e.getFragmentShader() ?? "");
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (node instanceof Effect) {
        const group = [node]; let conv = isConv(node), uv = mainUv(node);
        let next: Effect | Pass | undefined;
        while ((next = list[i + 1]) instanceof Effect) {
          const nc = isConv(next), nu = mainUv(next);
          if ((conv && nc) || (conv && nu) || (uv && nc)) break;
          group.push(next); conv ||= nc; uv ||= nu; i++;
        }
        c.addPass(new EffectPass(camera, ...group));
      } else c.addPass(node);
    }
    return c;
    // rebuild only when the pass objects themselves change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, multisampling, ...list]);
  useEffect(() => () => {
    // dispose only what we created (RenderPass/EffectPass wrappers); the effects belong to the caller
    for (const p of composer.passes) if (p instanceof RenderPass || p instanceof EffectPass) p.dispose();
  }, [composer]);
  const dpr = gl.getPixelRatio();
  useMemo(() => composer.setSize(size.width, size.height), [composer, size.width, size.height, dpr]);
  gl.toneMapping = THREE.NoToneMapping;
  useFrame((_, delta) => {
    const auto = gl.autoClear; gl.autoClear = true;
    composer.render(delta);
    gl.autoClear = auto;
  }, 1);
  return null;
};
