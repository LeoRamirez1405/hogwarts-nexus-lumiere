"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import type { MentionTextProps } from "./types";
import { SPECIAL_MENTION_DESCRIPTIONS } from "@/lib/mentions";

// Patrón del comando grupal (@all/@alle/@alla/@allX). El lookahead negativo
// evita comer "@allison": si "@"+"all" va seguido de otra letra, falla y
// cae al patrón de nombre de usuario más abajo.
const SPECIAL_SOURCE = "@(all[a-z]?)(?![A-Za-z\\u00C0-\\u017F])";
const NAME_SOURCE = "@([A-Za-z\\u00C0-\\u017F]+(?: [A-Za-z\\u00C0-\\u017F]+)*)";

function specialMentionHtml(command: string, isOwn: boolean): string {
  const description = SPECIAL_MENTION_DESCRIPTIONS[command] ?? "Mención grupal";
  const classes = isOwn
    ? "font-semibold text-white bg-white/20 rounded px-1 cursor-help"
    : "font-semibold text-primary bg-primary/10 rounded px-1 cursor-help";
  return `<span class="${classes}" title="${description}">@${command}</span>`;
}

function nameMentionHtml(name: string, members?: MentionTextProps["members"]): string {
  const member = members?.find((m) => m.user?.name?.toLowerCase() === name.toLowerCase());
  const userId = member?.user_id?.replace(/[^a-zA-Z0-9_-]/g, "");
  if (userId) {
    return `<a class="font-semibold underline hover:opacity-80" href="/profile/${userId}">@${name}</a>`;
  }
  return `<span class="font-semibold underline">@${name}</span>`;
}

/**
 * Reemplaza las menciones (@Nombre, @all, @alle, @alla, @allX) por HTML crudo
 * en el texto que recibe ReactMarkdown. remark lo divide en nodos html+texto,
 * pero rehypeRaw lo reensambla y rehype-sanitize conserva span/a con sus
 * clases, de modo que los renderers `span`/`a` propagan el estilo final.
 *
 * Usa `matchAll` (que no retiene `lastIndex`) en una RegExp local nueva por
 * invocación, evitando estado compartido entre renders del componente.
 */
function injectMentions(text: string, members?: MentionTextProps["members"], isOwn = false): string {
  // Los comandos grupales van primero en la alternancia para que "@all..." no
  // se consuma como un nombre de usuario.
  const combined = new RegExp(`(?:${SPECIAL_SOURCE})|(?:${NAME_SOURCE})`, "gi");

  let processedText = text;
  let offset = 0;

  for (const match of text.matchAll(combined)) {
    const command = match[1] ? match[1].toLowerCase() : null;
    const html = command ? specialMentionHtml(command, isOwn) : nameMentionHtml(match[2] ?? "", members);
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
    "*": ["className", "style", "title"]
  }
};

// react-markdown v10 añade `node` a las props de los componentes; hay que
// extraerlo para que no se pinte como atributo `node="[object Object]"`.
type MarkdownProps<P> = P & { node?: unknown };

export const MentionText = ({ text, members, isOwn }: MentionTextProps) => {
  const processedText = useMemo(() => injectMentions(text, members, isOwn), [text, members, isOwn]);

  // TEMP: diagnóstico de menciones — quitar tras validar.
  if (typeof window !== "undefined" && text && text.includes("@")) {
    console.info("[MentionText] input:", JSON.stringify(text), "=> processed:", JSON.stringify(processedText));
  }

  const components = useMemo(() => ({
    a: ({ children, node: _node, ...props }: MarkdownProps<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => {
      // Enlaces internos a perfiles (menciones): navegación SPA, no abrir en otra pestaña.
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
      if (typeof window !== "undefined") {
        console.info("[MentionText span renderer] props:", props, "children:", children);
      }
      return <span {...props}>{children}</span>;
    },
  }), []);

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
