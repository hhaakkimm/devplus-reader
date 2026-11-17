"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// A scrollable box that, on every page change, scrolls its current link (aria-current) to the middle.
// Needed because a long module (32 lessons) puts the current lesson below the fold of the sidebar.
export function ScrollToActive({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2;
  }, [pathname]);
  return (
    // `relative`: offsetTop of the link is measured from this box.
    <div ref={ref} className={`relative ${className ?? ""}`}>
      {children}
    </div>
  );
}
