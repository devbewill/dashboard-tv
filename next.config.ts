import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // resvg è un binding nativo: va lasciato fuori dal bundle del server.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
