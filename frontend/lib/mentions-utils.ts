import { api } from "@/lib/api";

/** Mencion user format consumed by MentionText's `members` prop. */
export interface MentionMember {
  user_id: string;
  user?: { name: string };
}

/** Minimum shape of a comment with nested replies — shared by
 *  PostComment, ArticleComment and ForumComment. */
export interface CommentLike {
  id: string;
  user_id: string;
  body: string;
  author?: { id: string; name: string } | null;
  replies?: CommentLike[];
}

/** Minimum shape of an authorable content item (Post, Article, ForumThread). */
export interface ContentLike {
  author?: { id: string; name: string } | null;
  body?: string;
}

/* ------------------------------------------------------------------ */
/* Pure helpers (no async, no I/O)                                    */
/* ------------------------------------------------------------------ */

/** Regex that matches `@Name` or `@First Last` mentions in text. */
const MENTION_RE = /@([A-Za-z0-9_\u00C0-\u017F]+(?: [A-Za-z0-9_\u00C0-\u017F]+)*)/g;

/** Extract unique mention names from a text string. */
export function extractMentions(text: string): string[] {
  const mentions = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(text)) !== null) {
    mentions.add(match[1]);
  }
  return [...mentions];
}

/** Extract unique mention names from a tree of comments. */
export function extractMentionsFromComments(comments: CommentLike[]): string[] {
  const mentions = new Set<string>();
  const traverse = (cs: CommentLike[]) => {
    for (const c of cs) {
      MENTION_RE.lastIndex = 0;
      const matches = c.body.matchAll(MENTION_RE);
      for (const m of matches) mentions.add(m[1]);
      if (c.replies?.length) traverse(c.replies);
    }
  };
  traverse(comments);
  return [...mentions];
}

/** Build a `members` array from a parent content item (post/article/thread)
 *  and its comment tree — includes the content author and all comment authors. */
export function buildMembers(
  content: ContentLike | null,
  comments: CommentLike[]
): MentionMember[] {
  const seen = new Set<string>();
  const users: MentionMember[] = [];
  const add = (u?: { id: string; name: string } | null) => {
    if (u && !seen.has(u.id)) {
      seen.add(u.id);
      users.push({ user_id: u.id, user: { name: u.name } });
    }
  };
  add(content?.author);
  const traverse = (cs: CommentLike[]) => {
    for (const c of cs) {
      add(c.author);
      if (c.replies?.length) traverse(c.replies);
    }
  };
  traverse(comments);
  return users;
}

/** Merge two `members` arrays, keeping only unique users by `user_id`. */
export function mergeUniqueMembers(...arrays: MentionMember[][]): MentionMember[] {
  const seen = new Set<string>();
  const result: MentionMember[] = [];
  for (const arr of arrays) {
    for (const u of arr) {
      if (!seen.has(u.user_id)) {
        seen.add(u.user_id);
        result.push(u);
      }
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Async helpers (call the API)                                       */
/* ------------------------------------------------------------------ */

/** Resolve a list of mention names to `MentionMember` objects via the API.
 *  Returns [] on error or empty input. */
export async function fetchMentionedUsers(
  names: string[]
): Promise<MentionMember[]> {
  if (names.length === 0) return [];
  try {
    const results = await Promise.all(
      names.map((name) => api.searchUsers(name, false))
    );
    const flat = results.flat();
    const seen = new Set<string>();
    const unique = flat.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
    return unique.map((u) => ({ user_id: u.id, user: { name: u.name } }));
  } catch (e) {
    console.warn("Failed to fetch mentioned users:", e);
    return [];
  }
}

/** Convenience: resolve all mentions in a text string to members. */
export async function resolveTextMentions(text: string): Promise<MentionMember[]> {
  return fetchMentionedUsers(extractMentions(text));
}

/** Convenience: resolve all mentions in a comment tree to members. */
export async function resolveCommentMentions(
  comments: CommentLike[]
): Promise<MentionMember[]> {
  return fetchMentionedUsers(extractMentionsFromComments(comments));
}
