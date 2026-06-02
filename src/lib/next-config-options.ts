import type { NextConfig } from "next";

type NextConfigEnvironment = {
  NEXT_DIST_DIR?: string;
  NEXT_PUBLIC_BASE_PATH?: string;
};

const allowedDevOrigins = [
  "127.0.0.1",
  "localhost",
  "gangseunghyeon-uiui-macmini-1.tail1d831c.ts.net",
  "postcards-rush-fridge-abstracts.trycloudflare.com",
  "hopes-car-ridge-organ.trycloudflare.com",
];

export function normalizeNextBasePath(basePath = "") {
  const trimmedBasePath = basePath.trim();

  if (!trimmedBasePath || trimmedBasePath === "/") {
    return "";
  }

  const basePathWithLeadingSlash = trimmedBasePath.startsWith("/") ? trimmedBasePath : `/${trimmedBasePath}`;
  return basePathWithLeadingSlash.replace(/\/+$/, "");
}

export function normalizeNextDistDir(distDir = "") {
  return distDir.trim() || undefined;
}

export function buildNextConfig(env: NextConfigEnvironment, configDirectory: string): NextConfig {
  const normalizedBasePath = normalizeNextBasePath(env.NEXT_PUBLIC_BASE_PATH);
  const normalizedDistDir = normalizeNextDistDir(env.NEXT_DIST_DIR);

  return {
    basePath: normalizedBasePath || undefined,
    distDir: normalizedDistDir,
    allowedDevOrigins,
    devIndicators: {
      position: "top-left",
    },
    turbopack: {
      root: configDirectory,
    },
  };
}
