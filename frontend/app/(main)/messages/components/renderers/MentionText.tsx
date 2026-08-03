"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import type { MentionTextProps } from "./types";

const MENTION_REGEX = /@([A-Za-z\u00C0-\u017F]+(?: [A-Za-z\u00C0-\u017F]+)*)/g;
const MENTION_PLACEHOLDER_PREFIX = "__MENTION_";
const MENTION_PLACEHOLDER_SUFFIX = "__";

interface ProcessedMention {
  placeholder: string;
  name: string;
  userId?: string;
}

function processMentions(text: string, members?: MentionTextProps["members"]): { processedText: string; mentions: ProcessedMention[] } {
  const mentions: ProcessedMention[] = [];
  let processedText = text;
  let match: RegExpExecArray | null;
  let offset = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const mentionedName = match[1];
    const member = members?.find((m) => m.user?.name?.toLowerCase() === mentionedName.toLowerCase());
    const userId = member?.user_id;
    const placeholder = `${MENTION_PLACEHOLDER_PREFIX}${mentions.length}${MENTION_PLACEHOLDER_SUFFIX}`;
    mentions.push({ placeholder, name: mentionedName, userId });
    const matchStart = match.index + offset;
    const matchEnd = matchStart + match[0].length;
    processedText = processedText.slice(0, matchStart) + placeholder + processedText.slice(matchEnd);
    offset += placeholder.length - match[0].length;
  }

  return { processedText, mentions };
}

function createMentionElement(mention: ProcessedMention): React.ReactElement {
  const mentionContent = (
    <span className="font-semibold cursor-pointer hover:opacity-80 underline">
      @{mention.name}
    </span>
  );

  if (mention.userId) {
    return (
      <Link key={mention.placeholder} href={`/profile/${mention.userId}`} onClick={(e) => e.stopPropagation()}>
        {mentionContent}
      </Link>
    );
  }
  return <span key={mention.placeholder}>{mentionContent}</span>;
}

const SANITIZE_SCHEMA = {
  tagNames: [
    "p", "br", "strong", "em", "del", "code", "pre", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
    "a", "hr", "span", "div"
  ],
  attributes: {
    a: ["href", "target", "rel"],
    "*": ["class", "style"]
  }
};

export const MentionText = ({ text, members }: MentionTextProps) => {
  const { processedText, mentions } = useMemo(() => processMentions(text, members), [text, members]);

  const mentionMap = useMemo(() => {
    const map = new Map<string, ProcessedMention>();
    mentions.forEach((m) => map.set(m.placeholder, m));
    return map;
  }, [mentions]);

  const components = useMemo(() => ({
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:opacity-80"
        {...props}
      >
        {children}
      </a>
    ),
    code: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <code className="font-mono text-[0.9em] bg-black/10 px-1 rounded" {...props}>
        {children}
      </code>
    ),
    pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
      <pre className="bg-black/5 p-3 rounded overflow-x-auto my-2" {...props}>
        {children}
      </pre>
    ),
    blockquote: ({ children, ...props }: React.QuoteHTMLAttributes<HTMLQuoteElement>) => (
      <blockquote className="border-l-4 border-primary pl-3 italic text-gray-600 my-2" {...props}>
        {children}
      </blockquote>
    ),
    h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h1 className="text-xl font-bold my-2" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2 className="text-lg font-bold my-2" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h3 className="text-base font-bold my-2" {...props}>{children}</h3>
    ),
    table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-semibold" {...props}>{children}</th>
    ),
    td: ({ children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
      <td className="border border-gray-300 px-2 py-1" {...props}>{children}</td>
    ),
    ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
      <ul className="list-disc list-inside my-2 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
      <ol className="list-decimal list-inside my-2 space-y-1" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
      <li {...props}>{children}</li>
    ),
    hr: ({ ...props }: React.HTMLAttributes<HTMLHRElement>) => (
      <hr className="border-gray-300 my-3" {...props} />
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className="my-1" {...props}>{children}</p>
    ),
    strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <strong {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <em {...props}>{children}</em>
    ),
    del: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <del {...props}>{children}</del>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
      if (typeof children === "string" && mentionMap.has(children)) {
        return createMentionElement(mentionMap.get(children)!);
      }
      return <span {...props}>{children}</span>;
    },
  }), [mentionMap]);

  return (
    <ReactMarkdown
      components={components}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, SANITIZE_SCHEMA],
        rehypeHighlight,
      ]}
      allowedElements={[
        "p", "br", "strong", "em", "del", "code", "pre", "blockquote",
        "h1", "h2", "h3", "h4", "h5", "h6",
        "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
        "a", "hr", "span", "div"
      ]}
    >
      {processedText}
    </ReactMarkdown>
  );
};