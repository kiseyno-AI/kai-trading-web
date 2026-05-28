import type { NextConfig } from "next";

type NextConfigEnvironment = {
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

export function buildNextConfig(env: NextConfigEnvironment, configDirectory: string): NextConfig {
  const normalizedBasePath = normalizeNextBasePath(env.NEXT_PUBLIC_BASE_PATH);

  return {
    basePath: normalizedBasePath || undefined,
    allowedDevOrigins,
    devIndicators: {
      position: "top-left",
    },
    turbopack: {
      root: configDirectory,
    },
  };
}
