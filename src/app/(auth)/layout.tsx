import Link from "next/link";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";

// Halaman daftar & masuk: tanpa sidebar aplikasi, satu kolom sempit yang nyaman di HP.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mx-auto flex h-14 w-full max-w-md items-center px-4 sm:h-16">
        <Link href="/" aria-label="Kostera, ke beranda" className="flex min-h-11 items-center">
          <KosteraLogo />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-4 pb-10 sm:pt-10">
        {children}
      </main>
    </>
  );
}
