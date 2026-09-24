"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { KosteraLogo } from "@/components/app-shell/kostera-logo";
import { HREF_MASUK, HREF_MULAI, NAV_LANDING } from "@/components/landing/links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Menu navigasi landing untuk layar kecil. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Buka menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-4/5 max-w-xs gap-0">
        <SheetHeader className="border-b">
          <SheetTitle>
            <KosteraLogo />
          </SheetTitle>
          <SheetDescription className="sr-only">Navigasi halaman Kostera</SheetDescription>
        </SheetHeader>
        <nav aria-label="Navigasi halaman" className="p-2">
          <ul className="flex flex-col">
            {NAV_LANDING.map(({ href, label }) => (
              <li key={href}>
                <SheetClose asChild>
                  <a
                    href={href}
                    className="flex h-11 items-center rounded-lg px-3 text-base font-medium hover:bg-muted"
                  >
                    {label}
                  </a>
                </SheetClose>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t p-4">
          <Button asChild size="lg" className="h-11 text-base">
            <Link href={HREF_MULAI} onClick={() => setOpen(false)}>
              Mulai gratis
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 text-base">
            <Link href={HREF_MASUK} onClick={() => setOpen(false)}>
              Masuk
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
