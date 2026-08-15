import type { UserSearchResult } from "@/lib/api";
import type { Product } from "@/lib/api/products";

export interface SpecialMention {
  key: string;
  command: string;
  label: string;
  description: string;
  icon: string;
}

export const SPECIAL_MENTIONS: SpecialMention[] = [
  { key: "all", command: "@all", label: "Todos los miembros", description: "Mencionar a todos los miembros del grupo", icon: "groups" },
  { key: "alle", command: "@alle", label: "Estudiantes", description: "Mencionar a todos los estudiantes", icon: "school" },
  { key: "alla", command: "@alla", label: "Administradores", description: "Mencionar a todos los administradores", icon: "admin_panel_settings" },
  { key: "allg", command: "@allg", label: "Gryffindor", description: "Mencionar a todos los de Gryffindor", icon: "shield" },
  { key: "alls", command: "@alls", label: "Slytherin", description: "Mencionar a todos los de Slytherin", icon: "shield" },
  { key: "allh", command: "@allh", label: "Hufflepuff", description: "Mencionar a todos los de Hufflepuff", icon: "shield" },
  { key: "allr", command: "@allr", label: "Ravenclaw", description: "Mencionar a todos los de Ravenclaw", icon: "shield" },
];

export const SPECIAL_MENTION_REGEX = /@(all[a-z]?)(?![A-Za-z\u00C0-\u017F])/gi;

/** Mapa de descripciones de elementos de Borgin — se rellena en runtime
 *  tras resolver las menciones de un mensaje contra la API de productos. */
export const SPECIAL_MENTION_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  SPECIAL_MENTIONS.map((m) => [m.key, m.description])
);

export interface MentionSuggestion {
  kind: "user" | "command" | "element";
  id: string;
  label: string;
  sublabel?: string;
  avatarUrl?: string;
  initials?: string;
  icon?: string;
  insertText: string;
  /** Cantidad poseída (solo elementos de Borgin & Burkes). */
  count?: number;
}

export function userToSuggestion(user: UserSearchResult, getInitials: (name: string) => string): MentionSuggestion {
  return {
    kind: "user",
    id: user.id,
    label: user.name,
    sublabel: user.house,
    avatarUrl: user.avatar_url,
    initials: getInitials(user.name),
    insertText: user.name,
  };
}

export function commandToSuggestion(command: SpecialMention): MentionSuggestion {
  return {
    kind: "command",
    id: command.key,
    label: command.command,
    sublabel: command.description,
    icon: command.icon,
    insertText: command.key,
  };
}

/** Convierte un producto de Borgin & Burkes en una sugerencia de mención de
 *  elemento. Se usa el `image_url` del producto como avatar circular, y la
 *  `description` del producto como sub-etiqueta (tooltip/lista). */
export function productToSuggestion(product: Product, count?: number): MentionSuggestion {
  return {
    kind: "element",
    id: product.id,
    label: product.name,
    sublabel: product.description || "Artefacto de Borgin & Burkes",
    avatarUrl: product.image_url,
    icon: "auto_awesome",
    insertText: product.name,
    ...(count ? { count } : {}),
  };
}
