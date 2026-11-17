import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { NoctaLogo } from './NoctaLogo';

export function AgeGateModal() {
  const { ageConfirmedSession, confirmAgeInSession } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);

  if (ageConfirmedSession) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#100D10]/95 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div className="max-w-lg w-full bg-[#191217] border border-[#32101D] rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <NoctaLogo compact={false} />
          <div className="flex items-center gap-1 border border-[#32101D] rounded-lg p-1 bg-[#100D10]">
            <button
              type="button"
              onClick={() => setLang('fr')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                lang === 'fr' ? 'bg-[#4B1028] text-[#F4EEF0]' : 'text-[#B8AAB0] hover:text-[#F4EEF0]'
              }`}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                lang === 'en' ? 'bg-[#4B1028] text-[#F4EEF0]' : 'text-[#B8AAB0] hover:text-[#F4EEF0]'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wider text-[#C5A276] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{t.ageGate.badge}</span>
          </p>
          <h2 id="age-gate-title" className="font-display text-3xl font-semibold text-[#F4EEF0]">
            {t.ageGate.title}
          </h2>
          <p className="text-sm text-[#B8AAB0] leading-relaxed">{t.ageGate.subtitle}</p>
          <p className="text-xs text-[#B8AAB0]/80 leading-relaxed border-t border-[#32101D] pt-3">
            {t.ageGate.disclaimer}
          </p>
        </div>

        {declined ? (
          <div className="bg-[#32101D]/60 border border-[#781D35] rounded-lg p-4 text-sm text-[#F4EEF0]">
            {lang === 'fr'
              ? 'L’accès à NOCTA est strictement réservé aux personnes majeures (18+).'
              : 'Access to NOCTA is strictly restricted to adults aged 18 and older.'}
          </div>
        ) : (
          <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg bg-[#100D10] border border-[#32101D] hover:border-[#4B1028] transition-colors">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#781D35] rounded cursor-pointer"
            />
            <span className="text-xs sm:text-sm text-[#F4EEF0] leading-relaxed">
              {t.ageGate.acceptTerms}
            </span>
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#B8AAB0]">
          <div className="flex items-center gap-4">
            <Link to="/terms" onClick={confirmAgeInSession} className="underline hover:text-[#C5A276]">
              {t.legal.termsTitle}
            </Link>
            <Link to="/privacy" onClick={confirmAgeInSession} className="underline hover:text-[#C5A276]">
              {t.legal.privacyTitle}
            </Link>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          <button
            type="button"
            disabled={!checked}
            onClick={confirmAgeInSession}
            className="flex-1 px-5 py-3 bg-[#781D35] hover:bg-[#4B1028] disabled:opacity-40 disabled:cursor-not-allowed text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            {t.ageGate.confirmButton}
          </button>
          <button
            type="button"
            onClick={() => setDeclined(true)}
            className="px-5 py-3 border border-[#32101D] hover:border-[#781D35] text-[#B8AAB0] hover:text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            {t.ageGate.leaveButton}
          </button>
        </div>
      </div>
    </div>
  );
}
