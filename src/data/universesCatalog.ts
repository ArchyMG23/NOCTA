import type { ActivityFormat, Universe } from '../types/nocta';

export const NOCTA_UNIVERSES: Universe[] = [
  {
    id: 'decouverte',
    slug: 'decouverte',
    order: 1,
    category: 'fondations',
    titleFr: 'Découverte',
    titleEn: 'Discovery',
    descriptionFr:
      'Briser la surface et révéler les nuances insoupçonnées de votre partenaire à travers des échanges progressifs.',
    descriptionEn:
      'Move past the surface and uncover subtle facets of your partner through progressive, thoughtful exchanges.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'connexion-profonde',
    slug: 'connexion-profonde',
    order: 2,
    category: 'intimite-emotionnelle',
    titleFr: 'Connexion profonde',
    titleEn: 'Deep Connection',
    descriptionFr:
      'Vulnérabilité choisie, présence attentive et dialogues essentiels pour renforcer le lien émotionnel.',
    descriptionEn:
      'Intentional vulnerability, attentive presence, and essential dialogues to deepen your emotional bond.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'connaissance-du-partenaire',
    slug: 'connaissance-du-partenaire',
    order: 3,
    category: 'fondations',
    titleFr: 'Connaissance du partenaire',
    titleEn: 'Partner Knowledge',
    descriptionFr:
      'Tester votre intuition, comprendre les désirs silencieux et mesurer à quel point vous vous connaissez vraiment.',
    descriptionEn:
      'Test your intuition, understand unspoken desires, and measure how deeply you truly know each other.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'communication',
    slug: 'communication',
    order: 4,
    category: 'fondations',
    titleFr: 'Communication',
    titleEn: 'Communication',
    descriptionFr:
      'Formuler vos attentes, vos limites et vos envies avec clarté, douceur et précision.',
    descriptionEn:
      'Express expectations, boundaries, and desires with clarity, warmth, and precision.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'souvenirs-et-histoire',
    slug: 'souvenirs-et-histoire',
    order: 5,
    category: 'intimite-emotionnelle',
    titleFr: 'Souvenirs et histoire',
    titleEn: 'Memories & Story',
    descriptionFr:
      'Raviver vos moments fondateurs, vos rituels partagés et écrire la suite de votre récit à deux.',
    descriptionEn:
      'Revisit your defining moments, shared rituals, and co-author the next chapters of your story.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'complicite-et-amusement',
    slug: 'complicite-et-amusement',
    order: 6,
    category: 'jeu-complicite',
    titleFr: 'Complicité et amusement',
    titleEn: 'Playfulness & Chemistry',
    descriptionFr:
      'Légèreté complice, taquineries adultes et défis ludiques pour cultiver le rire et la spontanéité.',
    descriptionEn:
      'Witty banter, adult playfulness, and spontaneous challenges to nurture laughter and chemistry.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'romance-et-seduction',
    slug: 'romance-et-seduction',
    order: 7,
    category: 'seduction',
    titleFr: 'Romance et séduction',
    titleEn: 'Romance & Seduction',
    descriptionFr:
      'Entretenir l’art de se séduire à nouveau, par les mots, l’attention et la mise en scène.',
    descriptionEn:
      'Keep the art of seduction alive through intentional words, atmosphere, and anticipation.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'sensualite',
    slug: 'sensualite',
    order: 8,
    category: 'seduction',
    titleFr: 'Sensualité',
    titleEn: 'Sensuality',
    descriptionFr:
      'Ralentir le rythme pour explorer les sens, le toucher, le regard et la tension charnelle.',
    descriptionEn:
      'Slow down the tempo to explore touch, gaze, breath, and heightened sensory tension.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'education-sexuelle',
    slug: 'education-sexuelle',
    order: 9,
    category: 'savoir-adulte',
    titleFr: 'Éducation sexuelle',
    titleEn: 'Sexual Education',
    descriptionFr:
      'Fiches adultes rigoureuses et décomplexées sur le plaisir, l’anatomie, le consentement et la santé intime.',
    descriptionEn:
      'Rigorous, candid adult guides on pleasure, anatomy, consent, and intimate wellbeing.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'exploration-sexuelle-adulte',
    slug: 'exploration-sexuelle-adulte',
    order: 10,
    category: 'exploration-adulte',
    titleFr: 'Exploration sexuelle adulte',
    titleEn: 'Adult Sexual Exploration',
    descriptionFr:
      'Espace assumé et explicite dédié aux fantasmes, aux scénarios érotiques et aux nouvelles expériences consenties.',
    descriptionEn:
      'An unfiltered, consensual adult space dedicated to fantasies, erotic scenarios, and deeper physical exploration.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'amour-a-distance',
    slug: 'amour-a-distance',
    order: 11,
    category: 'jeu-complicite',
    titleFr: 'Amour à distance',
    titleEn: 'Long-Distance Love',
    descriptionFr:
      'Maintenir la présence, le désir et le rituel synchronisé même lorsque les kilomètres vous séparent.',
    descriptionEn:
      'Sustain presence, desire, and synchronized rituals even when miles keep you apart.',
    isActive: true,
    formatsCount: 5,
  },
  {
    id: 'aventures-a-deux',
    slug: 'aventures-a-deux',
    order: 12,
    category: 'exploration-adulte',
    titleFr: 'Aventures à deux',
    titleEn: 'Adventures for Two',
    descriptionFr:
      'Expériences hors du quotidien, escapades nocturnes et défis audacieux pensés pour deux.',
    descriptionEn:
      'Out-of-routine experiences, late-night escapades, and bold shared ventures crafted for two.',
    isActive: true,
    formatsCount: 5,
  },
];

const FORMAT_BLUEPRINTS: Array<{
  universeId: string;
  formats: Array<{ slug: string; titleFr: string; titleEn: string; descFr: string; descEn: string }>;
}> = [
  {
    universeId: 'decouverte',
    formats: [
      { slug: 'premiers-eclairages', titleFr: 'Premiers éclairages', titleEn: 'First Illuminations', descFr: 'Questions ouvertes pour cerner les valeurs et aspirations.', descEn: 'Open prompts to surface core values and aspirations.' },
      { slug: 'miroir-inattendu', titleFr: 'Miroir inattendu', titleEn: 'Unexpected Mirror', descFr: 'Révélations rapides à choix contrastés.', descEn: 'Fast-paced contrasting choice revelations.' },
      { slug: 'zones-inexplorees', titleFr: 'Zones inexplorées', titleEn: 'Uncharted Corners', descFr: 'Explorer ce qui n’a jamais encore été formulé.', descEn: 'Explore thoughts never yet spoken aloud.' },
      { slug: 'rituel-du-soir', titleFr: 'Rituel du soir', titleEn: 'Evening Ritual', descFr: 'Échanges courts pensés pour clore la journée ensemble.', descEn: 'Brief exchanges crafted to close the day together.' },
      { slug: 'portrait-croise', titleFr: 'Portrait croisé', titleEn: 'Crossed Portrait', descFr: 'Observer comment chacun perçoit la singularité de l’autre.', descEn: 'Notice how each perceives the other’s uniqueness.' },
    ],
  },
  {
    universeId: 'connexion-profonde',
    formats: [
      { slug: 'silences-partages', titleFr: 'Silences partagés', titleEn: 'Shared Silences', descFr: 'Présence guidée par le regard et la respiration.', descEn: 'Guided presence anchored in gaze and breath.' },
      { slug: 'verites-douces', titleFr: 'Vérités douces', titleEn: 'Gentle Truths', descFr: 'Confidences profondes dans un cadre bienveillant.', descEn: 'Deep confidences held in mutual care.' },
      { slug: 'ancrages-emotionnels', titleFr: 'Ancrages émotionnels', titleEn: 'Emotional Anchors', descFr: 'Identifier ce qui nourrit la sécurité affective.', descEn: 'Identify what nurtures emotional safety.' },
      { slug: 'lettres-orales', titleFr: 'Lettres orales', titleEn: 'Spoken Letters', descFr: 'Prendre deux minutes pour dire l’essentiel sans interruption.', descEn: 'Take two uninterrupted minutes to say what matters.' },
      { slug: 'horizon-commun', titleFr: 'Horizon commun', titleEn: 'Shared Horizon', descFr: 'Aligner vos projections intimes et vos envies futures.', descEn: 'Align your intimate visions and shared future.' },
    ],
  },
  {
    universeId: 'connaissance-du-partenaire',
    formats: [
      { slug: 'jeu-de-lintuition', titleFr: 'Jeu de l’intuition', titleEn: 'Intuition Game', descFr: 'Deviner la réponse exacte de l’autre avant révélation.', descEn: 'Predict your partner’s answer before simultaneous reveal.' },
      { slug: 'preferences-fines', titleFr: 'Préférences fines', titleEn: 'Subtle Preferences', descFr: 'Cartographier les détails qui font toute la différence.', descEn: 'Map the subtle details that make all the difference.' },
      { slug: 'angles-morts', titleFr: 'Angles morts', titleEn: 'Blind Spots', descFr: 'Découvrir ce que l’autre aimerait que vous sachiez.', descEn: 'Discover what your partner wishes you knew.' },
      { slug: 'echelle-du-desir', titleFr: 'Échelle du désir', titleEn: 'Desire Scale', descFr: 'Comparer vos niveaux d’envie sur des thèmes précis.', descEn: 'Compare appetite levels across specific themes.' },
      { slug: 'verifications-complices', titleFr: 'Vérifications complices', titleEn: 'Knowing Checks', descFr: 'Valider ou actualiser ce qui a évolué entre vous.', descEn: 'Update what has evolved between you over time.' },
    ],
  },
  {
    universeId: 'communication',
    formats: [
      { slug: 'accords-explicites', titleFr: 'Accords explicites', titleEn: 'Explicit Agreements', descFr: 'Formuler vos limites et zones vertes sans ambiguïté.', descEn: 'Articulate boundaries and green zones unambiguously.' },
      { slug: 'ecoute-active', titleFr: 'Écoute active', titleEn: 'Active Listening', descFr: 'Tours de parole structurés et reformulation attentive.', descEn: 'Structured speaking turns and attentive mirroring.' },
      { slug: 'desamorcage-serein', titleFr: 'Désamorçage serein', titleEn: 'Calm De-escalation', descFr: 'Aborder les sujets sensibles avec calme et respect.', descEn: 'Navigate sensitive topics with poise and care.' },
      { slug: 'demandes-claires', titleFr: 'Demandes claires', titleEn: 'Clear Requests', descFr: 'Transformer un non-dit en demande directe et positive.', descEn: 'Turn unspoken tension into a clear, positive request.' },
      { slug: 'bilan-intime', titleFr: 'Bilan intime', titleEn: 'Intimate Check-in', descFr: 'Rendez-vous périodique sur votre équilibre relationnel.', descEn: 'Periodic check-in on your relational balance.' },
    ],
  },
  {
    universeId: 'souvenirs-et-histoire',
    formats: [
      { slug: 'premiers-frissons', titleFr: 'Premiers frissons', titleEn: 'First Sparks', descFr: 'Revisiter la naissance de votre attirance.', descEn: 'Revisit the earliest sparks of your attraction.' },
      { slug: 'archives-secretes', titleFr: 'Archives secrètes', titleEn: 'Secret Archives', descFr: 'Partager un souvenir marquant jamais raconté.', descEn: 'Share a vivid memory never told before.' },
      { slug: 'moments-pivots', titleFr: 'Moments pivots', titleEn: 'Turning Points', descFr: 'Comprendre ce qui a consolidé votre histoire.', descEn: 'Reflect on the moments that defined your bond.' },
      { slug: 'traditions-privees', titleFr: 'Traditions privées', titleEn: 'Private Traditions', descFr: 'Créer ou raviver vos rituels exclusifs.', descEn: 'Create or revive your exclusive rituals.' },
      { slug: 'capsule-future', titleFr: 'Capsule future', titleEn: 'Future Capsule', descFr: 'Formuler une promesse ou un vœu pour l’année à venir.', descEn: 'Craft a promise or intention for the year ahead.' },
    ],
  },
  {
    universeId: 'complicite-et-amusement',
    formats: [
      { slug: 'duels-espiegles', titleFr: 'Duels espiègles', titleEn: 'Playful Duels', descFr: 'Mini-défis rapides à enjeu complice.', descEn: 'Quick playful challenges with charming stakes.' },
      { slug: 'verite-ou-audace-nocta', titleFr: 'Vérité ou Audace', titleEn: 'Truth or Boldness', descFr: 'Version adulte élégante et graduée du classique.', descEn: 'An elevated, graduated adult take on the classic.' },
      { slug: 'dilemmes-corces', titleFr: 'Dilemmes corsés', titleEn: 'Sharp Dilemmas', descFr: 'Trancher entre deux options audacieuses.', descEn: 'Choose between two bold, revealing options.' },
      { slug: 'impromptus', titleFr: 'Impromptus', titleEn: 'Impromptus', descFr: 'Mises en situation brèves pour briser la routine.', descEn: 'Brief spontaneous prompts to break routine.' },
      { slug: 'paris-a-deux', titleFr: 'Paris à deux', titleEn: 'Wagers for Two', descFr: 'Miser sur les réactions de votre partenaire.', descEn: 'Wager playfully on your partner’s reactions.' },
    ],
  },
  {
    universeId: 'romance-et-seduction',
    formats: [
      { slug: 'prelude-verbal', titleFr: 'Prélude verbal', titleEn: 'Verbal Prelude', descFr: 'Mots choisis pour installer le désir à distance ou face à face.', descEn: 'Chosen words to build desire up close or from afar.' },
      { slug: 'mise-en-scene', titleFr: 'Mise en scène', titleEn: 'Atmosphere Setting', descFr: 'Préparer une soirée ou une atmosphère dédiée.', descEn: 'Curate a dedicated evening and sensory setting.' },
      { slug: 'attentions-secretes', titleFr: 'Attentions secrètes', titleEn: 'Secret Gestures', descFr: 'Gestes de séduction subtils sur 24 heures.', descEn: 'Subtle gestures of seduction across 24 hours.' },
      { slug: 'regard-prolonge', titleFr: 'Regard prolongé', titleEn: 'Lingering Gaze', descFr: 'Jeux de tension visuelle sans précipitation.', descEn: 'Unhurried visual tension exercises.' },
      { slug: 'invitation-nocturne', titleFr: 'Invitation nocturne', titleEn: 'Nocturnal Invitation', descFr: 'Provoquer le rendez-vous comme au premier soir.', descEn: 'Spark a rendezvous as if it were the first night.' },
    ],
  },
  {
    universeId: 'sensualite',
    formats: [
      { slug: 'cartographie-du-toucher', titleFr: 'Cartographie du toucher', titleEn: 'Touch Mapping', descFr: 'Explorer les zones sensibles avec lenteur.', descEn: 'Explore sensitive areas with deliberate slowness.' },
      { slug: 'tempo-ralenti', titleFr: 'Tempo ralenti', titleEn: 'Slowed Tempo', descFr: 'Séquences chronométrées pour amplifier la montée du désir.', descEn: 'Timed sequences designed to heighten anticipation.' },
      { slug: 'privation-sensorielle', titleFr: 'Jeux de sens', titleEn: 'Sensory Play', descFr: 'Bandeau, souffle, contrastes de températures et textures.', descEn: 'Blindfold, breath, temperature, and texture contrasts.' },
      { slug: 'souffle-et-rythme', titleFr: 'Souffle et rythme', titleEn: 'Breath & Rhythm', descFr: 'Synchroniser la respiration avant le contact.', descEn: 'Synchronize breathing before physical contact.' },
      { slug: 'effleurements-guides', titleFr: 'Effleurements guidés', titleEn: 'Guided Caresses', descFr: 'Alterner le rôle de guide et celui qui reçoit.', descEn: 'Alternate between guiding and receiving touch.' },
    ],
  },
  {
    universeId: 'education-sexuelle',
    formats: [
      { slug: 'anatomie-du-plaisir', titleFr: 'Anatomie du plaisir', titleEn: 'Anatomy of Pleasure', descFr: 'Fiches claires sur les réponses corporelles et le plaisir.', descEn: 'Clear guides on bodily response and pleasure.' },
      { slug: 'culture-du-consentement', titleFr: 'Culture du consentement', titleEn: 'Consent Culture', descFr: 'Outils pratiques pour un consentement enthousiaste et continu.', descEn: 'Practical tools for enthusiastic, ongoing consent.' },
      { slug: 'mythes-et-realites', titleFr: 'Mythes et réalités', titleEn: 'Myths & Realities', descFr: 'Déconstruire les idées reçues sur la sexualité adulte.', descEn: 'Unpack common misconceptions about adult sexuality.' },
      { slug: 'cycles-du-desir', titleFr: 'Cycles du désir', titleEn: 'Desire Cycles', descFr: 'Comprendre désir spontané, désir réactif et rythmes.', descEn: 'Understand spontaneous vs. responsive desire.' },
      { slug: 'bien-etre-intime', titleFr: 'Bien-être intime', titleEn: 'Intimate Wellbeing', descFr: 'Repères de confort, protection et santé sexuelle.', descEn: 'Guidance on comfort, protection, and sexual health.' },
    ],
  },
  {
    universeId: 'exploration-sexuelle-adulte',
    formats: [
      { slug: 'fantasmes-devoiles', titleFr: 'Fantasmes dévoilés', titleEn: 'Unveiled Fantasies', descFr: 'Partager et croiser vos envies explicites en toute confiance.', descEn: 'Share and compare explicit desires in full trust.' },
      { slug: 'scenarios-erotiques', titleFr: 'Scénarios érotiques', titleEn: 'Erotic Scenarios', descFr: 'Jeux de rôles et scripts immersifs à adapter ensemble.', descEn: 'Immersive roleplay scripts tailored to both partners.' },
      { slug: 'defis-charnels', titleFr: 'Défis charnels', titleEn: 'Carnal Challenges', descFr: 'Actions directes et audacieuses graduées par intensité.', descEn: 'Direct, bold intimate actions graduated by intensity.' },
      { slug: 'nouvelles-dynamiques', titleFr: 'Nouvelles dynamiques', titleEn: 'New Dynamics', descFr: 'Explorer l’initiative, la prise de rôle et l’abandon consenti.', descEn: 'Explore initiative, role dynamics, and consensual surrender.' },
      { slug: 'nuits-sans-filtre', titleFr: 'Nuits sans filtre', titleEn: 'Unfiltered Nights', descFr: 'Expériences adultes complètes à intensité élevée.', descEn: 'Full high-intensity adult experiences for consented nights.' },
    ],
  },
  {
    universeId: 'amour-a-distance',
    formats: [
      { slug: 'synchronisation-nocturne', titleFr: 'Synchronisation nocturne', titleEn: 'Nocturnal Sync', descFr: 'Rendez-vous simultanés à travers l’écran ou la voix.', descEn: 'Simultaneous sessions across voice or screen.' },
      { slug: 'messages-differes', titleFr: 'Messages différés', titleEn: 'Delayed Dispatches', descFr: 'Indices et confidences envoyés au fil de la journée.', descEn: 'Clues and confidences sent throughout the day.' },
      { slug: 'voix-et-imaginaire', titleFr: 'Voix et imaginaire', titleEn: 'Voice & Imagination', descFr: 'Récits guidés par l’écoute et l’évocation.', descEn: 'Guided experiences led by voice and imagination.' },
      { slug: 'compte-a-rebours', titleFr: 'Compte à rebours', titleEn: 'Countdown Ritual', descFr: 'Préparer les retrouvailles étape par étape.', descEn: 'Build anticipation step by step until you reunite.' },
      { slug: 'revelation-simultanee', titleFr: 'Révélation simultanée', titleEn: 'Simultaneous Reveal', descFr: 'Répondre chacun de son côté puis découvrir ensemble.', descEn: 'Respond independently and reveal simultaneously.' },
    ],
  },
  {
    universeId: 'aventures-a-deux',
    formats: [
      { slug: 'escapades-nocturnes', titleFr: 'Escapades nocturnes', titleEn: 'Late-Night Escapades', descFr: 'Idées de sorties ou nuits hors du cadre habituel.', descEn: 'Ideas for nights and outings beyond your usual routine.' },
      { slug: 'missions-exterieures', titleFr: 'Missions discrètes', titleEn: 'Discreet Missions', descFr: 'Complicité secrète lors d’un dîner ou d’un voyage.', descEn: 'Secret chemistry during a dinner or weekend away.' },
      { slug: 'weekend-hors-temps', titleFr: 'Week-end hors du temps', titleEn: 'Timeless Weekend', descFr: 'Parcours complet sur 48 heures déconnectées.', descEn: 'A curated 48-hour unplugged experience for two.' },
      { slug: 'premieres-fois-a-deux', titleFr: 'Premières fois à deux', titleEn: 'Firsts Together', descFr: 'Expérimenter une nouveauté ensemble hors zone de confort.', descEn: 'Try something new together outside routine comfort.' },
      { slug: 'rituels-de-voyage', titleFr: 'Rituels de voyage', titleEn: 'Travel Rituals', descFr: 'Transformer chaque chambre d’hôtel en terrain de jeu.', descEn: 'Turn any hotel room into a private sanctuary.' },
    ],
  },
];

export const NOCTA_FORMATS: ActivityFormat[] = FORMAT_BLUEPRINTS.flatMap((group) =>
  group.formats.map((f, index) => ({
    id: `${group.universeId}__${f.slug}`,
    universeId: group.universeId,
    order: index + 1,
    slug: f.slug,
    titleFr: f.titleFr,
    titleEn: f.titleEn,
    descriptionFr: f.descFr,
    descriptionEn: f.descEn,
    participationModes: ['individual', 'couple', 'remote_sync', 'pass_device'],
    isActive: true,
  }))
);

export const STARTER_FOUNDATION_ACTIVITIES = [
  {
    id: 'act_seed_decouverte_01',
    universeId: 'decouverte',
    formatId: 'decouverte__premiers-eclairages',
    type: 'question' as const,
    titleFr: 'Ce que personne ne devine d’emblée',
    titleEn: 'What rarely shows at first glance',
    bodyFr:
      'Quelle facette de votre personnalité ou de votre désir reste généralement discrète, et comment aimeriez-vous qu’elle soit accueillie ce soir ?',
    bodyEn:
      'Which facet of your personality or desire usually stays quiet, and how would you like it to be welcomed tonight?',
    instructionsFr: 'Prenez chacun trois minutes sans interrompre l’autre.',
    instructionsEn: 'Take three uninterrupted minutes each to answer.',
    intimacyLevel: 2,
    durationMinutes: 10,
    contentHash: 'seed_decouverte_01_facet',
  },
  {
    id: 'act_seed_connexion_01',
    universeId: 'connexion-profonde',
    formatId: 'connexion-profonde__silences-partages',
    type: 'scenario' as const,
    titleFr: 'Deux minutes sans un mot',
    titleEn: 'Two minutes without words',
    bodyFr:
      'Asseyez-vous face à face dans une lumière tamisée. Maintenez le contact visuel pendant deux minutes en synchronisant votre respiration avant d’échanger une seule phrase vraie.',
    bodyEn:
      'Sit facing each other in dim light. Hold eye contact for two minutes while matching your breathing before sharing a single honest sentence.',
    instructionsFr: 'Vous pouvez interrompre ou ajuster la distance à tout moment.',
    instructionsEn: 'You may pause or adjust distance at any moment.',
    intimacyLevel: 2,
    durationMinutes: 6,
    contentHash: 'seed_connexion_01_silence',
  },
  {
    id: 'act_seed_communication_01',
    universeId: 'communication',
    formatId: 'communication__accords-explicites',
    type: 'question' as const,
    titleFr: 'Cartographie du consentement',
    titleEn: 'Consent mapping',
    bodyFr:
      'Nommez une attention ou une pratique qui vous met immédiatement en confiance, et une limite claire que vous souhaitez réaffirmer avec douceur.',
    bodyEn:
      'Name one gesture or practice that immediately builds trust for you, and one clear boundary you wish to reaffirm gently.',
    instructionsFr: 'Écoutez sans commenter ni justifier, puis remerciez votre partenaire.',
    instructionsEn: 'Listen without debating or justifying, then acknowledge your partner.',
    intimacyLevel: 2,
    durationMinutes: 12,
    contentHash: 'seed_communication_01_consent',
  },
  {
    id: 'act_seed_sensualite_01',
    universeId: 'sensualite',
    formatId: 'sensualite__cartographie-du-toucher',
    type: 'challenge' as const,
    titleFr: 'L’interdiction de se presser',
    titleEn: 'The slow-touch rule',
    bodyFr:
      'Pendant dix minutes, explorez uniquement les épaules, la nuque, les avant-bras et les mains de votre partenaire à l’aveugle, en modulant la pression selon ses indications verbales.',
    bodyEn:
      'For ten minutes, explore only your partner’s shoulders, neck, forearms, and hands with eyes closed, adjusting pressure solely by their verbal cues.',
    instructionsFr: 'Le partenaire qui reçoit peut dire « plus lent », « plus léger » ou « stop » à tout instant.',
    instructionsEn: 'The receiving partner may say "slower", "lighter", or "stop" at any moment.',
    intimacyLevel: 3,
    durationMinutes: 15,
    contentHash: 'seed_sensualite_01_touch',
  },
  {
    id: 'act_seed_education_01',
    universeId: 'education-sexuelle',
    formatId: 'education-sexuelle__cycles-du-desir',
    type: 'educational' as const,
    titleFr: 'Désir spontané et désir réactif',
    titleEn: 'Spontaneous vs. responsive desire',
    bodyFr:
      'Dans de nombreux couples adultes durables, le désir ne surgit pas toujours avant le rapprochement : il s’éveille souvent en réponse au contexte, à la sécurité émotionnelle et à la stimulation sensorielle. Comprendre cette différence évite de confondre rythme différent et manque d’attirance.',
    bodyEn:
      'In many lasting adult relationships, desire does not always appear before closeness begins—it often awakens in response to context, emotional safety, and sensory cues. Understanding this prevents mistaking differing rhythms for lack of attraction.',
    instructionsFr: 'Identifiez ensemble ce qui favorise votre passage du quotidien à l’intimité.',
    instructionsEn: 'Identify together what helps you transition from daily routine into intimacy.',
    intimacyLevel: 2,
    durationMinutes: 8,
    contentHash: 'seed_education_01_desire',
  },
  {
    id: 'act_seed_exploration_01',
    universeId: 'exploration-sexuelle-adulte',
    formatId: 'exploration-sexuelle-adulte__fantasmes-devoiles',
    type: 'question' as const,
    titleFr: 'Scénario non censuré',
    titleEn: 'Unfiltered scenario',
    bodyFr:
      'Décrivez un fantasme ou un scénario érotique précis que vous n’avez encore jamais mis en scène ensemble : quel décor, quel rythme et quel rôle vous attirent le plus ?',
    bodyEn:
      'Describe a specific fantasy or erotic scenario you have never acted out together: what setting, pace, and role appeal to you most?',
    instructionsFr: 'Réservé aux couples consentants. Chacun reste libre d’accepter, d’adapter ou de garder une idée dans l’imaginaire.',
    instructionsEn: 'For consented adults. Both partners remain free to accept, adapt, or keep any fantasy purely imaginative.',
    intimacyLevel: 5,
    durationMinutes: 15,
    contentHash: 'seed_exploration_01_fantasy',
  },
];
