import type { Metadata } from "next";

import { ChatKosta } from "@/components/kosta/chat-kosta";
import { getHalamanKosta } from "@/lib/data/kosta";

export const metadata: Metadata = {
  title: "Chat Kosta AI",
};

export default async function KostaPage() {
  const data = await getHalamanKosta();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Chat Kosta AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tanya tunggakan, kamar kosong, atau rekap pemasukan. Sama seperti chat Kosta AI di WhatsApp.
        </p>
      </header>
      <ChatKosta {...data} />
    </div>
  );
}
