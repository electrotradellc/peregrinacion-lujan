import type { MetadataRoute } from "next";

// Instalable tanto para capitanes de micro como para peregrinos (ver plan:
// "que todos se puedan descargar la app"). Reemplazar los íconos placeholder
// en public/icons/ por artes reales antes de publicar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Peregrinación a Luján",
    short_name: "Peregrinación",
    description: "Inscripción, asignación de micros y asistencia para la Peregrinación a Luján.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#171717",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
