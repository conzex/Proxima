import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
}

/** Proxima wordmark + logo (assets in /public). */
export function BrandLogo({ className, imageClassName, showText = false }: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2.5 hover:opacity-95 transition-opacity", className)}
      title={`${siteConfig.name} — Dashboard`}
      aria-label={`${siteConfig.name} home`}
    >
      <div className="flex items-center justify-center rounded-lg p-2 transition-colors bg-transparent dark:bg-white dark:shadow-sm">
        <Image
          src="/DarkLogo.png"
          alt={`${siteConfig.name} logo`}
          width={180}
          height={48}
          priority
          className={cn("h-10 w-auto object-contain max-h-12", imageClassName)}
        />
      </div>
      {showText && <span className="font-semibold text-lg tracking-tight">{siteConfig.name}</span>}
    </Link>
  );
}
