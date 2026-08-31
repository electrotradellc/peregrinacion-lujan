import { NextResponse } from "next/server";

// Endpoint temporal de diagnóstico — borrar después de usarlo.
export async function GET() {
  return NextResponse.json({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null });
}
