import { useEffect, useRef } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import type { LightboxModalData } from "../types/reports";
import { CloseIcon } from "./Icons";

interface ImageLightboxProps {
  modal: LightboxModalData | null;
  onClose: () => void;
}

export function ImageLightbox({ modal, onClose }: ImageLightboxProps) {
  const { t } = useLanguage();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modal) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, onClose]);

  if (!modal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full surface-elevated rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="min-w-0">
            <h3
              id="lightbox-title"
              className="text-base font-semibold text-white truncate"
            >
              {modal.title}
            </h3>
            {modal.meta && (
              <p className="text-xs text-slate-400 font-mono mt-0.5 tabular-nums">
                {modal.meta}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t.modalClose}
            className="focus-ring w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 bg-[#060a0e] flex items-center justify-center max-h-[75vh]">
          {modal.url ? (
            <img
              src={modal.url}
              alt={modal.title}
              className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
            />
          ) : (
            <p className="py-16 text-xs text-slate-400">{t.noPhotoStored}</p>
          )}
        </div>
      </div>
    </div>
  );
}
