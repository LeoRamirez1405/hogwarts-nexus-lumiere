"use client";

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export default function TabGroup({ tabs, activeTab, onChange }: TabGroupProps) {
  return (
    <div className="flex flex-row gap-2 flex-wrap">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2 text-body-md font-medium transition-all duration-200 ${
              isActive
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {tab.icon && (
              <span
                className="material-symbols-outlined text-[1.1em]"
                style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
              >
                {tab.icon}
              </span>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
