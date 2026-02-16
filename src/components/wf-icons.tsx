import { cn } from "@/lib/utils";

/**
 * Warframe Platinum icon — official game asset.
 */
export function PlatIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/platinum.png"
      alt="Platinum"
      className={cn("size-3.5 inline-block shrink-0 object-contain", className)}
      style={{ verticalAlign: "-0.125em" }}
    />
  );
}

/**
 * Warframe Endo icon — official game asset.
 */
export function EndoIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/endo.png"
      alt="Endo"
      className={cn("size-3.5 inline-block shrink-0 object-contain", className)}
      style={{ verticalAlign: "-0.125em" }}
    />
  );
}
