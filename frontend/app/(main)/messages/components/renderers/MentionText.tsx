"use client";

import Link from "next/link";
import type { MentionTextProps } from "./types";

const MENTION_REGEX = /@([A-Za-z\u00C0-\u017F]+(?: [A-Za-z\u00C0-\u017F]+)*)/g;
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

export const MentionText = ({ text, isOwn, members }: MentionTextProps) => {
  // First pass: handle mentions
  const mentionParts: React.ReactNode[] = [];
  let mentionLastIndex = 0;
  let mentionMatch: RegExpExecArray | null;
  while ((mentionMatch = MENTION_REGEX.exec(text)) !== null) {
    if (mentionMatch.index > mentionLastIndex) {
      mentionParts.push(text.slice(mentionLastIndex, mentionMatch.index));
    }
    const mentionedName = mentionMatch[1];
    const member = members?.find((m) => m.user?.name?.toLowerCase() === mentionedName.toLowerCase());
    const userId = member?.user_id;
    const mentionContent = (
      <span className={`font-semibold cursor-pointer hover:opacity-80 ${isOwn ? "text-white underline" : "text-primary underline"}`}>
        @{mentionedName}
      </span>
    );
    if (userId) {
      mentionParts.push(
        <Link key={mentionMatch.index} href={`/profile/${userId}`} onClick={(e) => e.stopPropagation()}>
          {mentionContent}
        </Link>
      );
    } else {
      mentionParts.push(<span key={mentionMatch.index}>{mentionContent}</span>);
    }
    mentionLastIndex = mentionMatch.index + mentionMatch[0].length;
  }
  if (mentionLastIndex < text.length) {
    mentionParts.push(text.slice(mentionLastIndex));
  }

  // Now flatten and handle URLs in text segments
  const processUrlInParts = (nodes: React.ReactNode[]): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    for (const node of nodes) {
      if (typeof node === "string") {
        let urlLastIndex = 0;
        let urlMatch: RegExpExecArray | null;
        while ((urlMatch = URL_REGEX.exec(node)) !== null) {
          if (urlMatch.index > urlLastIndex) {
            result.push(node.slice(urlLastIndex, urlMatch.index));
          }
          const url = urlMatch[1];
          result.push(
            <a
              key={urlMatch.index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
            >
              {url}
            </a>
          );
          urlLastIndex = urlMatch.index + urlMatch[0].length;
        }
        if (urlLastIndex < node.length) {
          result.push(node.slice(urlLastIndex));
        }
      } else {
        result.push(node);
      }
    }
    return result;
  };

  return <span>{processUrlInParts(mentionParts)}</span>;
};