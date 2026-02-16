import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "bcryptjs", "node-fetch", "socks-proxy-agent", "https-proxy-agent", "socks"],
};

export default nextConfig;
