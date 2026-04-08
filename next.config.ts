import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "postcards-rush-fridge-abstracts.trycloudflare.com",
    "hopes-car-ridge-organ.trycloudflare.com",
  ],
  turbopack: {
    root: configDirectory,
  },
};

export default nextConfig;
