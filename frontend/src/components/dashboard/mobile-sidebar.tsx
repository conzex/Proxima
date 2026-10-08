"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/dashboard/sidebar";

/**
 * Mobile-only navigation: hamburger below `md` opens a native `<dialog>` drawer
 * (no React portal layer) with the same nav as the desktop sidebar.
 */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
    dialogRef.current?.close();
  }, [pathname]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      <dialog
        ref={dialogRef}
        className="mobile-nav-dialog md:hidden"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
          <SidebarNav />
        </div>
      </dialog>
    </>
  );
}
