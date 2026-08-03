export const CATEGORY_ICONS: Record<string, string> = {
  pet_type: "pets",
  book_category: "menu_book",
  article_category: "article",
  borgin_category: "dark_mode",
};

export const SYSTEM_CATEGORIES = ["pet_type", "book_category", "article_category", "borgin_category"];

export const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "dashboard" },
  treasury: { label: "Tesorería", icon: "diamond" },
  pets: { label: "Mascotas", icon: "pets" },
  events: { label: "Eventos", icon: "event" },
};
