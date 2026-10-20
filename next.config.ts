import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components stays off for v1: every Cooky page is per-user and dynamic, and with it
  // on, any cookies() read outside a <Suspense> boundary is a build error (see DESIGN.md).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
