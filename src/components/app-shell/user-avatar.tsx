import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function inisial(nama: string) {
  return nama
    .split(/\s+/)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserAvatar({ nama, className }: { nama: string; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
        {inisial(nama)}
      </AvatarFallback>
    </Avatar>
  );
}
