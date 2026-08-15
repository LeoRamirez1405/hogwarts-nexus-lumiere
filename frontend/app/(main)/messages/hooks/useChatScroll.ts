import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "@/lib/api";

interface UseChatScrollOptions {
  messages: Message[];
  convId?: string | null;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  firstUnreadId?: string | null;
  targetMessageId?: string | null;
  loadNonce?: number;
}

export function useChatScroll({
  messages,
  hasMore,
  loadingOlder,
  onLoadOlder,
  firstUnreadId,
  targetMessageId,
  loadNonce = 0,
}: UseChatScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newCount, setNewCount] = useState(0);

  // --- Scroll positioning bookkeeping (WhatsApp-style) ---------------------
  // stickToBottom reflects whether the user was near the bottom *before* the
  // last content change, so we know whether to auto-follow new messages.
  const stickToBottomRef = useRef(true);
  const prevNonceRef = useRef(0);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  const jumpedTargetRef = useRef<string | null>(null);

  const NEAR_BOTTOM_PX = 120;
  const PREFETCH_TOP_PX = 300; // start loading older well before the top

  const scrollToBottom = useCallback((smooth = true) => {
    const c = containerRef.current;
    if (!c) return;
    c.scrollTo({ top: c.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewCount(0);
    setShowScrollBtn(false);
    stickToBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const distanceFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
    const nearBottom = distanceFromBottom < NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
    if (nearBottom) setNewCount(0);
    // Lazy-load older messages before the user actually hits the top.
    if (c.scrollTop < PREFETCH_TOP_PX && hasMore && !loadingOlder) {
      onLoadOlder?.();
    }
  }, [hasMore, loadingOlder, onLoadOlder]);

  // A fresh conversation page has arrived (loadNonce is bumped by useMessages
  // after the first page for the conversation loads). ChatMessages remounts
  // the Virtuoso keyed by convId:loadNonce with initialTopMostItemIndex, so
  // the viewport lands on the unread divider (or at the bottom). Here we
  // instantly scroll to match (Telegram-style: no animation).
  useEffect(() => {
    if (loadNonce === 0 || loadNonce === prevNonceRef.current) return;
    prevNonceRef.current = loadNonce;
    prevFirstIdRef.current = messages[0]?.id ?? null;
    prevLastIdRef.current = messages[messages.length - 1]?.id ?? null;
    prevScrollHeightRef.current = 0;
    stickToBottomRef.current = true;

    requestAnimationFrame(() => {
      // Position-dependent UI resets (after Virtuoso's initial layout settled).
      setNewCount(0);
      const hasUnread = firstUnreadId
        ? messages.some((m) => m.id === firstUnreadId)
        : false;
      setShowScrollBtn(hasUnread);
      const c = containerRef.current;
      if (c) {
        prevScrollHeightRef.current = c.scrollHeight;
        // Instant scroll to bottom to match Virtuoso's initialTopMostItemIndex
        c.scrollTo({ top: c.scrollHeight, behavior: "auto" });
      }
    });
  }, [loadNonce, messages, firstUnreadId]);

  // React to later content changes: older pages prepended at the top (keep the
  // current view anchored) and new messages appended at the bottom (follow only
  // when the user was already near the bottom).
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const first = messages[0]?.id ?? null;
    const last = messages[messages.length - 1]?.id ?? null;

    if (first !== prevFirstIdRef.current) {
      const delta = c.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) c.scrollTop += delta;
    }
    if (last !== prevLastIdRef.current) {
      if (stickToBottomRef.current) {
        c.scrollTop = c.scrollHeight;
      } else {
        setNewCount((n) => n + 1);
        setShowScrollBtn(true);
      }
    }
    prevFirstIdRef.current = first;
    prevLastIdRef.current = last;
    prevScrollHeightRef.current = c.scrollHeight;
  }, [messages]);

  // Jump + highlight a specific message (from a mention notification).
  useEffect(() => {
    if (!targetMessageId || jumpedTargetRef.current === targetMessageId) return;
    if (!messages.some((m) => m.id === targetMessageId)) return; // not loaded yet
    jumpedTargetRef.current = targetMessageId;
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${targetMessageId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-message");
      setTimeout(() => el.classList.remove("highlight-message"), 2000);
    });
  }, [targetMessageId, messages]);

  const snapToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    setNewCount(0);
  }, []);

  return {
    containerRef,
    dividerRef,
    scrollToBottom,
    handleScroll,
    showScrollBtn,
    newCount,
    snapToBottom,
  };
}
