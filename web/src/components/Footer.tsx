import { useLanguage } from "../i18n/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="mt-16 border-t border-slate-800/70 bg-[#060a0e]/60">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
        <span className="font-medium text-slate-300">{t.footerAuthority}</span>
        <div className="flex flex-wrap items-center gap-4">
          <span>{t.footerTelemetry}</span>
          <span className="text-slate-600" aria-hidden="true">
            •
          </span>
          <a
            href="https://t.me/fyp_qwerty_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring hover:text-[#34c397] transition-colors rounded"
          >
            {t.footerIntake}
          </a>
        </div>
      </div>
    </footer>
  );
}
