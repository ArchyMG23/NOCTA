import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { DEFAULT_HOMEPAGE_EDITORIAL } from '../data/editorialDefaults';
import { NOCTA_UNIVERSES } from '../data/universesCatalog';
import {
  fetchHomepageEditorial,
  fetchPublicLandingMedia,
  fetchUniverses,
} from '../services/noctaService';
import { EditorialLandingView } from '../components/EditorialLandingView';
import type { HomepageEditorialPayload, MediaAsset, Universe } from '../types/nocta';

export function LandingPage() {
  const { firebaseUser, isEmailVerified } = useAuth();
  const { lang, setLang, t } = useI18n();
  const [universes, setUniverses] = useState<Universe[]>(NOCTA_UNIVERSES);
  const [editorial, setEditorial] = useState<HomepageEditorialPayload>(
    DEFAULT_HOMEPAGE_EDITORIAL
  );
  const [publicMedia, setPublicMedia] = useState<MediaAsset[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchUniverses().catch(() => NOCTA_UNIVERSES),
      fetchHomepageEditorial('homepage_published').catch(() => ({
        payload: DEFAULT_HOMEPAGE_EDITORIAL,
        version: 1,
        exists: false,
      })),
      fetchPublicLandingMedia().catch(() => [] as MediaAsset[]),
    ]).then(([uList, edRes, medList]) => {
      if (!active) return;
      if (uList.length > 0) setUniverses(uList.filter((u) => u.isActive));
      setEditorial(edRes.payload);
      setPublicMedia(medList);
    });
    return () => {
      active = false;
    };
  }, []);

  const isAuthed = Boolean(firebaseUser && isEmailVerified);

  return (
    <EditorialLandingView
      lang={lang}
      onToggleLang={() => setLang(lang === 'fr' ? 'en' : 'fr')}
      isAuthed={isAuthed}
      editorial={editorial}
      universes={universes}
      mediaAssets={publicMedia}
      translations={{
        navUniverses: t.nav.universes,
        navExperience: t.nav.experience,
        navPrivacy: t.nav.privacy,
        navDashboard: t.nav.dashboard,
        navSignIn: t.nav.signIn,
        formatsCount: t.universes.formatsCount,
        exploreLabel: lang === 'fr' ? 'Explorer' : 'Explore',
        privacyTitle: t.legal.privacyTitle,
        termsTitle: lang === 'fr' ? 'Conditions d’utilisation' : 'Terms of Use',
      }}
    />
  );
}
