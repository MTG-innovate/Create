import type { MetadataRoute } from "next";

// Lets families add JOSIA Care to their phone's home screen. On iPhone,
// reminders work only once it is added there.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JOSIA Care",
    short_name: "JOSIA Care",
    description: "No one should carry care alone. One warm place to share care with everyone who helps.",
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
