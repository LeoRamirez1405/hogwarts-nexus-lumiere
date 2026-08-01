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
}

export function useChatScroll({
  messages,
  convId,
  hasMore,
  loadingOlder,
  onLoadOlder,
  firstUnreadId,
  targetMessageId,
}: UseChatScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newCount, setNewCount] = useState(0);

  // --- Scroll positioning bookkeeping (WhatsApp-style) ---------------------
  // stickToBottom reflects whether the user was near the bottom *before* the
  // last content change, so we know whether to auto-follow new messages.
  const stickToBottomRef = useRef(true);
  const prevConvIdRef = useRef<string | null>(null);
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

  // Position the viewport whenever messages or the conversation change.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const currentConvId = convId ?? null;
    const first = messages[0]?.id ?? null;
    const last = messages[messages.length - 1]?.id ?? null;

    if (prevConvIdRef.current !== currentConvId) {
      // Wait until the first page has actually loaded before positioning, so
      // the transient "empty" reset render doesn't consume the switch.
      if (messages.length === 0) return;
      // Fresh conversation: jump to the unread divider, else to the bottom.
      prevConvIdRef.current = currentConvId;
      prevFirstIdRef.current = first;
      prevLastIdRef.current = last;
      requestAnimationFrame(() => {
        const cc = containerRef.current;
        if (!cc) return;
        if (firstUnreadId && dividerRef.current) {
          dividerRef.current.scrollIntoView({ block: "center" });
          stickToBottomRef.current = false;
          setShowScrollBtn(true);
        } else {
          cc.scrollTop = cc.scrollHeight;
          stickToBottomRef.current = true;
          setShowScrollBtn(false);
        }
        prevScrollHeightRef.current = cc.scrollHeight;
      });
      return;
    }

    // Older page prepended at the top: keep the current view anchored.
    if (first !== prevFirstIdRef.current) {
      const delta = c.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) c.scrollTop += delta;
    }
    // New message appended at the bottom.
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
  }, [messages, convId, firstUnreadId]);

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
