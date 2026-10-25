import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off: every page reads the signed-in session, and
  // health data should never sit in a server-side render cache.
  cacheComponents: false,
  experimental: {
    // A photo of a visit summary, shrunk in the browser first, for Claude to read.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Invitation links carry a token in the URL; never pass it on to other sites.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
