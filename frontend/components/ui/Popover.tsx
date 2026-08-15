"use client";

import {
  PopoverTrigger,
  PopoverContent,
  PopoverPortal,
  Root,
} from "@radix-ui/react-popover";

interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export default function Popover({
  trigger,
  children,
  side = "bottom",
  align = "center",
}: PopoverProps) {
  return (
    <Root>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side={side}
          align={align}
          sideOffset={4}
          className="z-[100] rounded-xl bg-surface-container-highest p-4 shadow-xl border border-outline-variant/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {children}
        </PopoverContent>
      </PopoverPortal>
    </Root>
  );
}