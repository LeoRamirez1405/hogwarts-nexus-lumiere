"use client";
import { useState } from "react";

interface Language {
  code: string;
  label: string;
  flag: string;
}

const languages: Language[] = [
  { code: "ES", label: "Espanol", flag: "🇪🇸" },
  { code: "EN", label: "English", flag: "🇬🇧" },
  { code: "FR", label: "Francais", flag: "🇫🇷" },
  { code: "DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "PT", label: "Portugues", flag: "🇧🇷" },
];

export default function LanguageSelector() {
  const [selected, setSelected] = useState<Language>(languages[1]);

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 rounded-full text-body-md text-on-surface-variant hover:bg-surface-container-high transition-colors">
        <span className="text-lg">{selected.flag}</span>
        <span className="text-label-sm font-medium">{selected.code}</span>
        <span
          className="material-symbols-outlined text-[1em]"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
        >
          expand_more
        </span>
      </button>

      <div className="absolute right-0 top-full mt-1 min-w-[160px] bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/20 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setSelected(lang)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-body-md hover:bg-surface-container-high transition-colors ${
              lang.code === selected.code
                ? "text-primary font-medium"
                : "text-on-surface-variant"
            }`}
          >
            <span className="text-lg">{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
