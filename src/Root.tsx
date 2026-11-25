// All compositions. One folder per video in src/videos/<name>/ (cartoon-3d-short layout).
import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";

export const Root: React.FC = () => (
  <>
    {/* sample build from the cartoon-3d-short skill (Mr omi, MIT). Copy src/videos/bridge/ to start a new video. */}
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
