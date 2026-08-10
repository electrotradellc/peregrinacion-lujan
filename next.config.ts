import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // Next.js bloquea por defecto los pedidos al servidor de desarrollo que
  // vengan de un origen distinto a localhost (protección anti DNS-rebinding).
  // Hace falta esto para poder probar desde el celular/otra compu en la
  // misma red usando la IP local — si esa IP cambia (reinicio del router,
  // etc.), hay que actualizarla acá.
  allowedDevOrigins: ["192.168.0.190"],
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // La app funciona igual sin service worker en dev; evita el ruido de
  // recompilarlo en cada guardado.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
