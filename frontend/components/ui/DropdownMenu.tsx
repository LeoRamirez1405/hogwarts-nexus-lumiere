"use client";

import {
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Root,
} from "@radix-ui/react-dropdown-menu";
import { MaterialIcon } from "./MaterialIcon";

export interface DropdownItem {
  label: string;
  icon?: string;
  danger?: boolean;
  onClick?: () => void;
  separator?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: "start" | "center" | "end";
}

export default function DropdownMenu({
  trigger,
  items,
  align = "end",
}: DropdownMenuProps) {
  return (
    <Root>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={4}
        className="z-[100] min-w-48 rounded-xl bg-surface-container-highest py-1 shadow-xl border border-outline-variant/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        {items.map((item, i) =>
          item.separator ? (
            <DropdownMenuSeparator
              key={`sep-${i}`}
              className="mx-2 my-1 h-px bg-outline-variant/20"
            />
          ) : (
            <DropdownMenuItem
              key={`${item.label}-${i}`}
              onSelect={item.onClick}
              className={`flex items-center gap-3 px-3 py-2.5 text-body-md cursor-pointer outline-none transition-colors data-[highlighted]:bg-surface-container-hover data-[disabled]:opacity-40 data-[disabled]:pointer-events-none ${
                item.danger ? "text-error" : "text-on-surface"
              }`}
            >
              {item.icon && (
                <MaterialIcon
                  name={item.icon}
                  className="text-xl text-on-surface-variant"
                />
              )}
              {item.label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </Root>
  );
}