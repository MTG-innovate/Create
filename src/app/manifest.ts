import type { MetadataRoute } from "next";

// Lets families add Little Steps to their phone's home screen. On iPhone,
// reminders work only once it is added there.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Little Steps",
    short_name: "Little Steps",
    description: "One warm place for your little one's care, shared with everyone who helps.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F1",
    theme_color: "#FFF8F1",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
