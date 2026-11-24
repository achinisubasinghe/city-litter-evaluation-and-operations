import { useLanguage } from "../i18n/LanguageContext";
import { LANGUAGE_OPTIONS } from "../i18n/translations";
import { GlobeIcon } from "./Icons";

export function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t.languageSwitchLabel}
      className="inline-flex items-center gap-0.5 rounded-lg bg-[#0a1017] p-0.5 border border-slate-700/60"
    >
      <span className="pl-2 pr-1 text-slate-400 hidden sm:inline-flex items-center">
        <GlobeIcon className="w-3.5 h-3.5" />
      </span>
      {LANGUAGE_OPTIONS.map((option) => {
        const isActive = lang === option.code;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.nativeName}
            onClick={() => setLang(option.code)}
            className={`focus-ring px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 active:scale-[0.97] cursor-pointer ${
              isActive
                ? "bg-[#192836] text-[#34c397] border border-[#22a07b]/35 shadow-sm"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
