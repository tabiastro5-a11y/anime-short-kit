// Used by `npx remotion studio|still|render` (the CLI). Run them from the repo root.
import { Config } from "@remotion/cli/config";
// WebGL through Vulkan was the stable choice on a Windows PC with an integrated AMD GPU.
// If stills come out blank on your machine, try "angle" or remove this line.
Config.setChromiumOpenGlRenderer("vulkan");
