"use client";
import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

interface Language {
  code: string;
  label: string;
}

const languages: Language[] = [
  { code: "ES", label: "Español" },
  { code: "EN", label: "English" },
  { code: "FR", label: "Français" },
  { code: "DE", label: "Deutsch" },
  { code: "PT", label: "Português" },
];

function getDefaultLang(): Language {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("lang");
    const found = languages.find((l) => l.code === stored);
    if (found) return found;
  }
  if (typeof document !== "undefined") {
    const docLang = document.documentElement.lang?.toUpperCase();
    const found = languages.find((l) => l.code === docLang);
    if (found) return found;
  }
  return languages[1];
}

const DEFAULT_LANG = getDefaultLang();

function applyLanguage(code: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = code.toLowerCase();
  window.dispatchEvent(
    new CustomEvent("languagechange", { detail: { code } })
  );
}

applyLanguage(DEFAULT_LANG.code);

export default function LanguageSelector() {
  const [selected, setSelected] = useState<Language>(DEFAULT_LANG);

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-full text-body-md text-on-surface-variant hover:bg-surface-container-high transition-colors focus:outline-none"
        aria-label={`Idioma actual: ${selected.label}`}
      >
        <span className="text-label-sm font-medium">{selected.code}</span>
        <MaterialIcon name="expand_more" className="text-[1em]" />
      </button>

      <div
        role="menu"
        aria-label="Seleccionar idioma"
        className="absolute right-0 top-full mt-1 min-w-[160px] bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant/20 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
      >
        {languages.map((lang) => (
          <button
            key={lang.code}
            role="menuitem"
            onClick={() => {
              if (typeof localStorage !== "undefined")
                localStorage.setItem("lang", lang.code);
              setSelected(lang);
              applyLanguage(lang.code);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 text-body-md hover:bg-surface-container-high transition-colors ${
              lang.code === selected.code
                ? "text-primary font-medium"
                : "text-on-surface-variant"
            }`}
          >
            <span>{lang.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}