// Pemeriksaan awal (optimistis) sebelum halaman/API aplikasi dijalankan: tanpa cookie sesi,
// halaman diarahkan ke /masuk dan API dijawab 401. Keabsahan sesi & hak akses kos tetap diperiksa
// di lapisan data (getWorkspaceSession / getWorkspaceSessionApi).

import { NextResponse, type NextRequest } from "next/server";

import { keputusanProxy } from "@/lib/auth/proxy-sesi";

export function proxy(request: NextRequest) {
  switch (keputusanProxy(request)) {
    case "lanjut":
      return NextResponse.next();
    case "tolak_api":
      return NextResponse.json({ galat: "Sesi berakhir. Masuk lagi dengan nomor WhatsApp." }, { status: 401 });
    case "ke_masuk":
      return NextResponse.redirect(new URL("/masuk", request.url));
  }
}

// Halaman aplikasi & API berdata kos. Landing, daftar/masuk, invoice publik, auth, webhook, dan cron
// tidak diperiksa di sini.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tagihan/:path*",
    "/kamar/:path*",
    "/pembayaran/:path*",
    "/reminder/:path*",
    "/kosta/:path*",
    "/pilih-kos",
    "/api/dashboard/:path*",
    "/api/kosta/:path*",
    "/api/akun/:path*",
  ],
};
