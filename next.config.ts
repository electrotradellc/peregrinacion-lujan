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
  // Por defecto Serwist recarga la página entera apenas el celular vuelve a
  // estar "online". En el modo sin conexión del referente eso borraba el
  // aviso "Volvió la señal" apenas aparecía (y con señal inestable recargaba
  // una y otra vez). La app ya maneja la vuelta de la señal por su cuenta.
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
