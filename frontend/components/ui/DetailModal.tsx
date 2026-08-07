"use client";

import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";
import Modal from "./Modal";
import BottomSheet from "./BottomSheet";

export interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  theme?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
}

export function DetailModal({
  open,
  onClose,
  title,
  children,
  theme = "light",
  size = "md",
  ariaLabel,
}: DetailModalProps) {
  const isDesktop = useIsDesktopMdUp();

  if (!open) return null;

  const modalClassName = theme === "dark"
    ? "!bg-inverse-surface !text-inverse-on-surface"
    : "bg-surface-container-lowest text-on-surface";

  if (isDesktop) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        size={size}
        ariaLabel={ariaLabel}
        className={modalClassName}
        showTitle={false}
      >
        {children}
      </Modal>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      ariaLabel={ariaLabel}
      className={modalClassName}
      showTitle={false}
    >
      {children}
    </BottomSheet>
  );
}

export default DetailModal;