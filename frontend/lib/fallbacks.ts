export type FallbackContext = 
  | 'artifact' 
  | 'book' 
  | 'creature' 
  | 'article' 
  | 'avatar' 
  | 'group' 
  | 'post' 
  | 'profile'
  | 'generic';

export type Theme = 'light' | 'dark';

const FALLBACK_MAP: Record<FallbackContext, Record<Theme, string>> = {
  artifact: {
    light: '/fallbacks/artifacts/artifact-light.svg',
    dark: '/fallbacks/artifacts/artifact-dark.svg',
  },
  book: {
    light: '/fallbacks/books/book-light.svg',
    dark: '/fallbacks/books/book-dark.svg',
  },
  creature: {
    light: '/fallbacks/creatures/creature-light.svg',
    dark: '/fallbacks/creatures/creature-dark.svg',
  },
  article: {
    light: '/fallbacks/articles/article-light.svg',
    dark: '/fallbacks/articles/article-dark.svg',
  },
  avatar: {
    light: '/fallbacks/avatars/avatar-light.svg',
    dark: '/fallbacks/avatars/avatar-dark.svg',
  },
  group: {
    light: '/fallbacks/groups/group-light.svg',
    dark: '/fallbacks/groups/group-dark.svg',
  },
  post: {
    light: '/fallbacks/posts/post-light.svg',
    dark: '/fallbacks/posts/post-dark.svg',
  },
  profile: {
    light: '/fallbacks/profile/profile-light.svg',
    dark: '/fallbacks/profile/profile-dark.svg',
  },
  generic: {
    light: '/fallbacks/generic/image-placeholder-light.svg',
    dark: '/fallbacks/generic/image-placeholder-dark.svg',
  },
};

export function getFallbackImageByContext(
  context: FallbackContext,
  theme: Theme = 'light'
): string {
  return FALLBACK_MAP[context]?.[theme] || FALLBACK_MAP.generic[theme];
}

export function getFallbackForProduct(
  shop: 'borgin' | 'flourish',
  theme: Theme = 'light'
): string {
  if (shop === 'borgin') {
    return getFallbackImageByContext('artifact', theme);
  }
  return getFallbackImageByContext('book', theme);
}

export function getFallbackForCreature(
  theme: Theme = 'light'
): string {
  return getFallbackImageByContext('creature', theme);
}

export function getFallbackForArticle(
  theme: Theme = 'light'
): string {
  return getFallbackImageByContext('article', theme);
}

export function getFallbackForAvatar(
  theme: Theme = 'light'
): string {
  return getFallbackImageByContext('avatar', theme);
}

export function getFallbackForGroup(
  theme: Theme = 'light'
): string {
  return getFallbackImageByContext('group', theme);
}

export function getFallbackForPost(
  theme: Theme = 'light'
): string {
  return getFallbackImageByContext('post', theme);
}

export function getFallbackForProfile(
  theme: Theme = 'light'
): string {
  return getFallbackImageByContext('profile', theme);
}

export function detectTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}