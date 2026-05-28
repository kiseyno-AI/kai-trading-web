import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildNextConfig } from "./src/lib/next-config-options";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = buildNextConfig(
  {
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  },
  configDirectory,
);

export default nextConfig;
