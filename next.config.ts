import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const normalizedBasePath = basePath && basePath !== "/" ? basePath.replace(/\/$/, "") : "";

const nextConfig: NextConfig = {
  basePath: normalizedBasePath || undefined,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "postcards-rush-fridge-abstracts.trycloudflare.com",
    "hopes-car-ridge-organ.trycloudflare.com",
    "gangseunghyeon-uiui-macmini-1.tail1d831c.ts.net",
  ],
  turbopack: {
    root: configDirectory,
  },
};

export default nextConfig;
