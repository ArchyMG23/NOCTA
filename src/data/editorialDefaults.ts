import type {
  AdultClassification,
  FocalPoint,
  HomepageEditorialPayload,
  MediaAsset,
  MediaCategory,
  MediaSpace,
} from '../types/nocta';

export const DEFAULT_MEDIA_CATEGORIES: Array<Omit<MediaCategory, 'updatedAt'>> = [
  { id: 'cat_accueil', slug: 'accueil', labelFr: 'Accueil', labelEn: 'Homepage', order: 1, isSystem: true },
  { id: 'cat_univers', slug: 'univers', labelFr: 'Univers', labelEn: 'Universes', order: 2, isSystem: true },
  { id: 'cat_activites', slug: 'activites', labelFr: 'Activités', labelEn: 'Activities', order: 3, isSystem: true },
  { id: 'cat_sensualite', slug: 'sensualite', labelFr: 'Sensualité', labelEn: 'Sensuality', order: 4, isSystem: true },
  {
    id: 'cat_exploration_adulte',
    slug: 'exploration-adulte',
    labelFr: 'Exploration adulte',
    labelEn: 'Adult Exploration',
    order: 5,
    isSystem: true,
  },
  {
    id: 'cat_education_sexuelle',
    slug: 'education-sexuelle',
    labelFr: 'Éducation sexuelle',
    labelEn: 'Sexual Education',
    order: 6,
    isSystem: true,
  },
  { id: 'cat_romance', slug: 'romance', labelFr: 'Romance', labelEn: 'Romance', order: 7, isSystem: true },
  { id: 'cat_bannieres', slug: 'bannieres', labelFr: 'Bannières', labelEn: 'Banners', order: 8, isSystem: true },
  {
    id: 'cat_illustrations',
    slug: 'illustrations',
    labelFr: 'Illustrations',
    labelEn: 'Illustrations',
    order: 9,
    isSystem: true,
  },
  { id: 'cat_autres', slug: 'autres', labelFr: 'Autres', labelEn: 'Other', order: 10, isSystem: true },
];

export const CURATED_LOCAL_PHOTOGRAPHS = [
  {
    url: '/src/assets/images/hero_nocta_sanctuary_1794947748772.jpg',
    labelFr: 'Clair-obscur NOCTA (Principale)',
    labelEn: 'NOCTA Chiaroscuro (Primary)',
  },
  {
    url: '/src/assets/images/editorial_intimacy_hands_1794947750001.jpg',
    labelFr: 'Mains & Peau (Intimité)',
    labelEn: 'Hands & Skin (Intimacy)',
  },
  {
    url: '/src/assets/images/editorial_couple_silhouette_1794947750360.jpg',
    labelFr: 'Silhouettes du soir',
    labelEn: 'Evening Silhouettes',
  },
  {
    url: '/src/assets/images/editorial_ritual_objects_1794947750820.jpg',
    labelFr: 'Rituel nocturne',
    labelEn: 'Nocturnal Ritual',
  },
];

export const DEFAULT_HOMEPAGE_EDITORIAL: HomepageEditorialPayload = {
  layoutVariant: 'full_bleed',
  sectionOrder: ['hero', 'editorial_spread', 'pillars', 'universes', 'privacy'],
  visibleSections: {
    hero: true,
    editorial_spread: true,
    pillars: true,
    universes: true,
    privacy: true,
  },
  heroPrimaryMediaId: '',
  heroFallbackUrl: '/src/assets/images/hero_nocta_sanctuary_1794947748772.jpg',
  heroFocalPoint: 'center',
  heroTitleFr: 'Découvrez-vous autrement.',
  heroTitleEn: 'Discover each other anew.',
  heroSecondaryTaglineFr: 'A private world for two.',
  heroSecondaryTaglineEn: 'A private world for two.',
  heroSubtitleFr:
    'Un club privé contemporain pour les couples qui cultivent le désir, la complicité, la sensualité et l’exploration sans filtre.',
  heroSubtitleEn:
    'A contemporary private club for adult couples cultivating desire, chemistry, sensuality, and unfiltered exploration.',
  heroPrimaryCtaFr: 'Créer mon compte',
  heroPrimaryCtaEn: 'Create account',
  heroPrimaryCtaLink: '/auth?mode=signup',
  heroSecondaryCtaFr: 'Se connecter',
  heroSecondaryCtaEn: 'Sign in',
  heroSecondaryCtaLink: '/auth?mode=signin',
  heroExploreLinkFr: 'Explorer les douze univers',
  heroExploreLinkEn: 'Explore the twelve universes',
  spreadTitleFr: 'Conçu pour l’intimité à deux',
  spreadTitleEn: 'Crafted for two-person intimacy',
  spreadSubtitleFr:
    'Loin des jeux génériques ou des plateformes tapageuses, NOCTA déploie une écriture éditoriale libre, charnelle et confidentielle.',
  spreadSubtitleEn:
    'Far removed from generic card games or noisy platforms, NOCTA composes a liberated, intimate, and confidential editorial world.',
  spreadPrimaryMediaId: '',
  spreadPrimaryFallbackUrl: '/src/assets/images/editorial_intimacy_hands_1794947750001.jpg',
  spreadPrimaryFocalPoint: 'center',
  spreadSecondaryMediaId: '',
  spreadSecondaryFallbackUrl: '/src/assets/images/editorial_couple_silhouette_1794947750360.jpg',
  spreadSecondaryFocalPoint: 'center',
  pillars: [
    {
      index: '01',
      titleFr: 'Anti-répétition certifié',
      titleEn: 'Verified anti-repetition',
      descFr:
        'Chaque expérience présentée à votre couple est inscrite dans un registre partagé. Elle ne revient jamais par hasard.',
      descEn:
        'Every experience presented to your couple is recorded in a shared ledger and never returns by chance.',
    },
    {
      index: '02',
      titleFr: 'Consentement & limites',
      titleEn: 'Consent & boundaries',
      descFr:
        'Chacun définit son intensité souhaitée, ses préférences et ses limites personnelles avant toute séance.',
      descEn:
        'Each partner defines their preferred intimacy ceiling, desires, and clear personal boundaries before any session.',
    },
    {
      index: '03',
      titleFr: 'Quatre modes d’exploration',
      titleEn: 'Four modes of exploration',
      descFr:
        'Préparé pour la réflexion individuelle, le duo côte à côte, la synchronisation à distance ou les tours alternés sur un même écran.',
      descEn:
        'Designed for solo reflection, couple side-by-side play, synchronized remote sessions, and pass-device alternating turns.',
    },
  ],
  universesTitleFr: 'Douze univers, soixante formats',
  universesTitleEn: 'Twelve universes, sixty formats',
  universesSubtitleFr:
    'De la connexion émotionnelle aux échanges les plus audacieux et explicites, chaque univers rassemble cinq formats structurés.',
  universesSubtitleEn:
    'From deep emotional closeness to bold, explicit adult exploration, each universe gathers five structured formats.',
  privacyTitleFr: 'Confidentialité absolue et gratuité totale',
  privacyTitleEn: 'Absolute privacy and completely free',
  privacyBodyFr:
    'La première édition de NOCTA est intégralement gratuite, sans publicité, sans abonnement ni revente de données. Vos confidences demeurent strictement cloisonnées au sein de votre duo.',
  privacyBodyEn:
    'NOCTA’s release is completely free—no subscriptions, no paywalls, no ads. Your private answers and couple history remain strictly compartmentalized.',
  privacyPointsFr: [
    'Données individuelles et données de couple strictement isolées',
    'Interruption immédiate et révocation possibles à tout moment',
    'Aucun accès indiscriminé à vos échanges intimes',
  ],
  privacyPointsEn: [
    'Individual and couple data strictly compartmentalized',
    'Immediate pause, exit, or boundary update at any time',
    'Zero indiscriminate access to intimate couple exchanges',
  ],
  privacyMediaId: '',
  privacyFallbackUrl: '/src/assets/images/editorial_ritual_objects_1794947750820.jpg',
  privacyFocalPoint: 'center',
};

export const FOCAL_POINT_CLASSES: Record<FocalPoint, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  left: 'object-left',
  right: 'object-right',
};

export const ADULT_CLASSIFICATION_LABELS: Record<
  AdultClassification,
  { fr: string; en: string }
> = {
  general: { fr: 'Général', en: 'General' },
  romantic: { fr: 'Romantique', en: 'Romantic' },
  sensual: { fr: 'Sensuel', en: 'Sensual' },
  erotic: { fr: 'Érotique', en: 'Erotic' },
  explicit: { fr: 'Explicite (Espaces protégés uniquement)', en: 'Explicit (Protected spaces only)' },
  educational: { fr: 'Éducatif', en: 'Educational' },
};

export const MEDIA_SPACE_LABELS: Record<MediaSpace, { fr: string; en: string }> = {
  public_landing: { fr: 'Accueil public', en: 'Public Landing' },
  universes: { fr: 'Univers & Formats', en: 'Universes & Formats' },
  couple_space: { fr: 'Espace Couple', en: 'Couple Space' },
  individual_space: { fr: 'Espace Individuel', en: 'Individual Space' },
  education: { fr: 'Fiches éducatives', en: 'Educational Guides' },
};

export function resolveEditorialImageUrl(
  mediaId: string | undefined | null,
  mediaMap: Map<string, MediaAsset>,
  fallbackUrl: string,
  targetSpace: MediaSpace = 'public_landing'
): { src: string; focalPoint: FocalPoint; alt?: string } {
  if (mediaId && mediaMap.has(mediaId)) {
    const asset = mediaMap.get(mediaId)!;
    const isExplicit = asset.adultClassification === 'explicit';
    const allowedOnTarget = asset.allowedSpaces.includes(targetSpace);
    const blockedOnPublic = targetSpace === 'public_landing' && isExplicit;

    if (asset.status === 'published' && !blockedOnPublic && allowedOnTarget) {
      return {
        src: `/api/media/file/${asset.fileId}`,
        focalPoint: asset.focalPoint || 'center',
        alt: asset.titleFr,
      };
    }
  }
  return {
    src: fallbackUrl,
    focalPoint: 'center',
  };
}
