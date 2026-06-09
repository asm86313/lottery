import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/lottery-api/:path*",
        destination: "https://www.dhlottery.co.kr/:path*",
      },
    ];
  },
};

export default nextConfig;
