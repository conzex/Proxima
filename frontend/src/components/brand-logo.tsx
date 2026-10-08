import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
}

/** Text-only product mark — no favicon / image assets. */
export function BrandLogo({ className, showText = true }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight text-foreground hover:opacity-90 transition-opacity",
        className,
      )}
      aria-label={`${siteConfig.name} home`}
    >
      {showText ? <span className="text-lg">{siteConfig.name}</span> : <span className="text-base">{siteConfig.name}</span>}
    </Link>
  );
}
