"use client";

import {
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  Root,
} from "@radix-ui/react-context-menu";
import { MaterialIcon } from "./MaterialIcon";
import type { DropdownItem } from "./DropdownMenu";

interface ContextMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
}

export default function ContextMenu({ trigger, items }: ContextMenuProps) {
  return (
    <Root>
      <ContextMenuTrigger asChild>{trigger}</ContextMenuTrigger>
      <ContextMenuContent
        className="z-[100] min-w-48 rounded-xl bg-surface-container-highest py-1 shadow-xl border border-outline-variant/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        {items.map((item, i) =>
          item.separator ? (
            <ContextMenuSeparator
              key={`sep-${i}`}
              className="mx-2 my-1 h-px bg-outline-variant/20"
            />
          ) : (
            <ContextMenuItem
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
            </ContextMenuItem>
          )
        )}
      </ContextMenuContent>
    </Root>
  );
}