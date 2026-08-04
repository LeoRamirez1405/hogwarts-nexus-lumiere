"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import Button from "./Button";
import { haptic, type HapticPattern } from "@/lib/haptics";

interface HapticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hapticPattern?: HapticPattern;
}

const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  (
    {
      hapticPattern = "light",
      onClick,
      ...props
    },
    ref
  ) => {
    const handleClick = onClick
      ? (e: React.MouseEvent<HTMLButtonElement>) => {
          haptic(hapticPattern);
          onClick(e);
        }
      : undefined;

    return (
      <Button ref={ref} onClick={handleClick} {...props} />
    );
  }
);

HapticButton.displayName = "HapticButton";

export default HapticButton;