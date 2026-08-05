"use client";

import { useCallback, useRef } from "react";

export interface CaretCoords {
  x: number;
  y: number;
  lineHeight: number;
}

export function useCaretPosition(textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const getCaretCoords = useCallback((): CaretCoords | null => {
    const textarea = textareaRef.current;
    if (!textarea) return null;

    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart === undefined || selectionStart !== selectionEnd) return null;

    const computed = getComputedStyle(textarea);
    const lineHeight = parseFloat(computed.lineHeight) || 24;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
    const fontSize = parseFloat(computed.fontSize) || 16;
    const fontFamily = computed.fontFamily;
    const borderTopWidth = parseFloat(computed.borderTopWidth) || 0;
    const borderLeftWidth = parseFloat(computed.borderLeftWidth) || 0;

    const text = textarea.value.substring(0, selectionStart);
    const lines = text.split("\n");
    const currentLine = lines.length - 1;
    const currentLineText = lines[currentLine];

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      ctxRef.current = canvasRef.current.getContext("2d");
    }
    const ctx = ctxRef.current!;
    ctx.font = `${fontSize}px ${fontFamily}`;
    const textWidth = ctx.measureText(currentLineText).width;

    const rect = textarea.getBoundingClientRect();

    const x = rect.left + borderLeftWidth + paddingLeft + textWidth;
    const y = rect.top + borderTopWidth + paddingTop + currentLine * lineHeight;

    return { x, y, lineHeight };
  }, [textareaRef]);

  return { getCaretCoords };
}