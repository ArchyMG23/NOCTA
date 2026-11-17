import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { NoctaLogo } from '../components/NoctaLogo';

export function LegalPage({ docType }: { docType: 'privacy' | 'terms' }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="min-h-screen bg-[#100D10] text-[#F4EEF0]">
      <header className="h-16 px-4 sm:px-8 border-b border-[#32101D] flex items-center justify-between max-w-5xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-[#B8AAB0] hover:text-[#F4EEF0]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.legal.backLink}</span>
        </Link>
        <NoctaLogo />
        <button
          type="button"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="px-3 py-1.5 text-xs border border-[#32101D] rounded-md text-[#C5A276] cursor-pointer"
        >
          {lang.toUpperCase()}
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12 space-y-8">
        <div className="space-y-2 border-b border-[#32101D] pb-6">
          <p className="text-xs text-[#C5A276] tracking-wider">NOCTA · 18+</p>
          <h1 className="font-display text-4xl font-semibold text-[#F4EEF0]">
            {docType === 'privacy' ? t.legal.privacyTitle : t.legal.termsTitle}
          </h1>
        </div>

        {docType === 'privacy' ? (
          <div className="space-y-6 text-sm text-[#B8AAB0] leading-relaxed">
            <section className="space-y-2">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? '1. Cloisonnement strict des données' : '1. Strict Data Isolation'}
              </h2>
              <p>
                {lang === 'fr'
                  ? 'NOCTA sépare les données personnelles individuelles (e-mail, limites intimes, consentement, paramètres de confidentialité) des données partagées au sein d’un couple validé. Aucune réponse intime de couple n’est exposée publiquement ou consultable librement par les administrateurs.'
                  : 'NOCTA strictly separates individual private records (email, personal boundaries, consent logs, privacy preferences) from shared couple records. Intimate couple responses are never public or indiscriminately accessible to administrators.'}
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? '2. Historique anti-répétition et favoris' : '2. Anti-Repetition History & Favorites'}
              </h2>
              <p>
                {lang === 'fr'
                  ? 'L’historique des activités présentées est rattaché à l’espace couple (ou à votre compte en mode individuel) afin de garantir l’absence de répétition automatique entre appareils et sessions.'
                  : 'Activity history is bound to your couple sanctuary (or your account in individual mode) to guarantee non-repetition across devices and sessions.'}
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? '3. Documents importés en administration' : '3. Administrative Document Imports'}
              </h2>
              <p>
                {lang === 'fr'
                  ? 'Les documents PDF et DOCX importés par les équipes autorisées sont stockés dans un espace privé non public et traités de façon strictement déterministe sans recours à une intelligence artificielle externe.'
                  : 'PDF and DOCX files uploaded by authorized administrators remain in private non-public storage and are parsed deterministically without external AI services.'}
              </p>
            </section>
          </div>
        ) : (
          <div className="space-y-6 text-sm text-[#B8AAB0] leading-relaxed">
            <section className="space-y-2">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? '1. Accès réservé aux adultes (18+)' : '1. Adult-Only Access (18+)'}
              </h2>
              <p>
                {lang === 'fr'
                  ? 'L’accès à NOCTA est exclusivement réservé aux personnes âgées de 18 ans ou plus. La confirmation demandée à l’entrée constitue une déclaration de majorité de l’utilisateur et non une vérification officielle d’identité.'
                  : 'NOCTA is strictly limited to adults aged 18 and older. The entry gate constitutes an adult self-declaration and does not represent formal identity verification.'}
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? '2. Consentement continu et droit d’interruption' : '2. Ongoing Consent & Right to Exit'}
              </h2>
              <p>
                {lang === 'fr'
                  ? 'Aucune activité ou expérience intime ne doit être menée sans le consentement libre et explicite des participants. Chaque partenaire peut quitter ou interrompre une expérience à tout moment.'
                  : 'No intimate activity or experience may proceed without the explicit, ongoing consent of all participants. Either partner may pause or leave an experience at any moment.'}
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? '3. Gratuité de la version initiale' : '3. Free Initial Release'}
              </h2>
              <p>
                {lang === 'fr'
                  ? 'La première version de NOCTA est entièrement gratuite, sans abonnement, sans contenu payant ni publicité.'
                  : 'The initial release of NOCTA is completely free of charge, with no subscriptions, paid content, or advertising.'}
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
