"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface WhisperButtonProps {
  ign: string;
  rivenName: string;
  price: number;
  auctionUrl?: string | null;
  weaponName?: string;
  template?: string;
}

export function WhisperButton({
  ign,
  rivenName,
  price,
  auctionUrl,
  weaponName,
  template,
}: WhisperButtonProps) {
  const defaultTemplate =
    "/w {ign} Hi! I want to buy your {weapon_name} {riven_name} listed for {price}p";

  const message = (template || defaultTemplate)
    .replace("{ign}", ign)
    .replace("{riven_name}", rivenName || "Riven")
    .replace("{price}", String(price))
    .replace("{weapon_name}", weaponName || "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success(`Copied whisper for ${weaponName || rivenName}`, {
        description: message,
        duration: 3000,
      });
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 w-7 p-0 hover:text-primary hover:glow-cyan"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono text-xs max-w-xs">{message}</p>
        </TooltipContent>
      </Tooltip>

      {auctionUrl && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 w-7 p-0 hover:text-primary"
            >
              <a href={auctionUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open on Warframe Market</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
