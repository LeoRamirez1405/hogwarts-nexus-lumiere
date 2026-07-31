"use client";

import {
  Provider,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  Root,
} from "@radix-ui/react-tooltip";

interface TooltipProps {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
  children: React.ReactNode;
}

export default function Tooltip({
  content,
  side = "top",
  delayDuration = 400,
  children,
}: TooltipProps) {
  return (
    <Provider delayDuration={delayDuration}>
      <Root>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            side={side}
            sideOffset={4}
            className="z-[100] rounded-lg bg-inverse-surface px-3 py-1.5 text-label-sm text-inverse-on-surface shadow-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
          >
            {content}
          </TooltipContent>
        </TooltipPortal>
      </Root>
    </Provider>
  );
}