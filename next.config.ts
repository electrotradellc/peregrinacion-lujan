import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // La app funciona igual sin service worker en dev; evita el ruido de
  // recompilarlo en cada guardado.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
