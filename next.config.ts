import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "postcards-rush-fridge-abstracts.trycloudflare.com",
    "hopes-car-ridge-organ.trycloudflare.com",
  ],
};

export default nextConfig;
