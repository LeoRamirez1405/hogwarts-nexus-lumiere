"use client";

import { useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { SPECIAL_MENTION_DESCRIPTIONS } from "@/lib/mentions";
import ElementBadge from "./ElementBadge";

const SPECIAL_SOURCE = "@(all[a-z]?)(?![A-Za-z\\u00C0-\\u017F])";
const NAME_SOURCE = "@([A-Za-z0-9_\\u00C0-\\u017F]+(?: [A-Za-z0-9_\\u00C0-\\u017F]+)*)";
// Elementos de Borgin & Burkes: `!(Nombre del elemento)` —
// regex literal: sin problemas de escaping de strings.
const ELEMENT_SOURCE = /!\(([^)]+)\)/;

interface MentionMember {
  user_id: string;
  user?: {
    name: string;
  };
}

interface MentionTextProps {
  text: string;
  members?: MentionMember[];
  isOwn?: boolean;
  className?: string;
}

function specialMentionHtml(command: string, isOwn: boolean): string {
  const description = SPECIAL_MENTION_DESCRIPTIONS[command] ?? "Mención grupal";
  const classes = isOwn
    ? "font-semibold text-white bg-white/20 rounded px-1 cursor-help"
    : "font-semibold text-primary bg-primary/10 rounded px-1 cursor-help";
  return `<span class="${classes}" title="${description}">@${command}</span>`;
}

function nameMentionHtml(name: string, members?: MentionMember[]): string {
  const member = members?.find((m) => m.user?.name?.toLowerCase() === name.toLowerCase());
  const userId = member?.user_id?.replace(/[^a-zA-Z0-9_-]/g, "");
  if (userId) {
    return `<a class="font-semibold underline hover:opacity-80" href="/profile/${userId}">@${name}</a>`;
  }
  return `<span class="font-semibold underline text-primary">@${name}</span>`;
}

/** Inserta un marcador para elemento de Borgin & Burkes. El renderer `span`
 *  de ReactMarkdown lo detecta por `data-element` y renderiza el componente
 *  ElementBadge (círculo con imagen + nombre, popover con descripción). */
function elementMentionHtml(name: string): string {
  const safeName = name.replace(/"/g, "'");
  return `<span data-element="${safeName}"></span>`;
}

function injectMentions(text: string, members?: MentionMember[], isOwn = false): string {
  const combined = new RegExp(`(?:${SPECIAL_SOURCE})|(?:${NAME_SOURCE})|(?:${ELEMENT_SOURCE.source})`, "gi");

  let processedText = text;
  let offset = 0;

  for (const match of text.matchAll(combined)) {
    let html: string;
    if (match[1]) {
      // comando especial @all...
      html = specialMentionHtml(match[1].toLowerCase(), isOwn);
    } else if (match[2]) {
      // @nombre de usuario
      html = nameMentionHtml(match[2], members);
    } else {
      // !(Elemento de Borgin)
      html = elementMentionHtml(match[3] ?? "");
    }
    const matchStart = match.index ?? 0;
    const targetStart = matchStart + offset;
    const targetEnd = targetStart + match[0].length;
    processedText = processedText.slice(0, targetStart) + html + processedText.slice(targetEnd);
    offset += html.length - match[0].length;
  }

  return processedText;
}

const SANITIZE_SCHEMA = {
  tagNames: [
    "p", "br", "strong", "em", "del", "code", "pre", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td",
    "a", "hr", "span", "div"
  ],
  attributes: {
    a: ["href", "target", "rel", "className"],
    span: ["className", "style", "title", "data*"],
    div: ["className", "style", "title", "data*"]
  }
};

type MarkdownProps<P> = P & { node?: unknown };

export const MentionText = ({ text, members, isOwn, className }: MentionTextProps) => {
  const processedText = useMemo(() => injectMentions(text, members, isOwn), [text, members, isOwn]);

  const components = useMemo(() => ({
    a: ({ children, node: _node, ...props }: MarkdownProps<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => {
      if (typeof props.href === "string" && props.href.startsWith("/profile/")) {
        return (
          <Link href={props.href} className="font-semibold underline hover:opacity-80" onClick={(e) => e.stopPropagation()}>
            {children}
          </Link>
        );
      }
      return (
        <a
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
          {...props}
        >
          {children}
        </a>
      );
    },
    code: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLElement>>) => (
      <code className="font-mono text-[0.9em] bg-black/10 px-1 rounded" {...props}>
        {children}
      </code>
    ),
    pre: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLPreElement>>) => (
      <pre className="bg-black/5 p-3 rounded overflow-x-auto my-2" {...props}>
        {children}
      </pre>
    ),
    blockquote: ({ children, node: _node, ...props }: MarkdownProps<React.QuoteHTMLAttributes<HTMLQuoteElement>>) => (
      <blockquote className="border-l-4 border-primary pl-3 italic text-gray-600 my-2" {...props}>
        {children}
      </blockquote>
    ),
    h1: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLHeadingElement>>) => (
      <h1 className="text-xl font-bold my-2" {...props}>{children}</h1>
    ),
    h2: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLHeadingElement>>) => (
      <h2 className="text-lg font-bold my-2" {...props}>{children}</h2>
    ),
    h3: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLHeadingElement>>) => (
      <h3 className="text-base font-bold my-2" {...props}>{children}</h3>
    ),
    table: ({ children, node: _node, ...props }: MarkdownProps<React.TableHTMLAttributes<HTMLTableElement>>) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, node: _node, ...props }: MarkdownProps<React.ThHTMLAttributes<HTMLTableCellElement>>) => (
      <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-semibold" {...props}>{children}</th>
    ),
    td: ({ children, node: _node, ...props }: MarkdownProps<React.TdHTMLAttributes<HTMLTableCellElement>>) => (
      <td className="border border-gray-300 px-2 py-1" {...props}>{children}</td>
    ),
    ul: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLUListElement>>) => (
      <ul className="list-disc list-inside my-2 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLOListElement>>) => (
      <ol className="list-decimal list-inside my-2 space-y-1" {...props}>{children}</ol>
    ),
    li: ({ children, node: _node, ...props }: MarkdownProps<React.LiHTMLAttributes<HTMLLIElement>>) => (
      <li {...props}>{children}</li>
    ),
    hr: ({ node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLHRElement>>) => (
      <hr className="border-gray-300 my-3" {...props} />
    ),
    p: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLParagraphElement>>) => (
      <p className="my-1" {...props}>{children}</p>
    ),
    strong: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLElement>>) => (
      <strong {...props}>{children}</strong>
    ),
    em: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLElement>>) => (
      <em {...props}>{children}</em>
    ),
    del: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLElement>>) => (
      <del {...props}>{children}</del>
    ),
    span: ({ children, node: _node, ...props }: MarkdownProps<React.HTMLAttributes<HTMLSpanElement>>) => {
      // Marcador de elemento de Borgin & Burkes: `!(Nombre)` inyectado por
      // injectMentions → renderiza el badge con imagen y popover.
      const elementName = (props as Record<string, unknown>)["data-element"];
      if (typeof elementName === "string") {
        return <ElementBadge name={elementName} isOwn={isOwn} />;
      }
      return <span {...props}>{children}</span>;
    },
  }), [isOwn]);

  return (
    <div className={className}>
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm, remarkBreaks]}
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
    </div>
  );
};
