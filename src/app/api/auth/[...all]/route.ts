// Endpoint Better Auth (/api/auth/*). Yang dipakai Kostera:
// - POST /api/auth/phone-number/send-otp { phoneNumber: "628…" } — kirim kode OTP lewat WhatsApp
//   (daftar & masuk memakai alur yang sama; dibatasi per IP).
// - POST /api/auth/phone-number/verify { phoneNumber, code } — cek kode; akun dibuat otomatis untuk
//   nomor baru, lalu cookie sesi dipasang.
// - GET /api/auth/get-session, POST /api/auth/sign-out.

import { getAuth } from "@/lib/auth/server";

async function tangani(request: Request) {
  return (await getAuth()).handler(request);
}

export { tangani as GET, tangani as POST };
