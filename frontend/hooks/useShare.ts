"use client";

import { useCallback } from "react";
import { hapticSelection } from "@/lib/haptics";

interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

export function useShare() {
  const share = useCallback(async (data: ShareData) => {
    hapticSelection();
    const { title, text, url = window.location.href } = data;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        console.debug("User cancelled native share:", error);
      }
    }

    navigator.clipboard?.writeText(url).catch(() => {});
  }, []);

  return { share };
}