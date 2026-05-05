import type { MetadataRoute } from "next";

/** Uses icons from /public — Android Chrome + installable PWA metadata. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finora",
    short_name: "Finora",
    description: "Personal finance clarity — AI-assisted tracking",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf5",
    theme_color: "#ffd100",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
