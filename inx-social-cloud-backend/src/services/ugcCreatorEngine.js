const CREATOR_PROFILE_VERSION = 'ugc-creators-v2';

const CREATOR_ROUTE_KEYS = Object.freeze({
  STANDARD: 'H3_MAX_STANDARD_V1',
  PREMIUM_CREATOR: 'OMNIHUMAN_CREATOR_V1'
});

const ALL_CREATOR_ROUTES = Object.freeze(Object.values(CREATOR_ROUTE_KEYS));

const CATEGORY_PROFILES = Object.freeze({
  BEAUTY: { niches: ['Beauty', 'Skincare', 'Product review'], environments: ['bedroom vanity', 'bathroom shelf', 'bright apartment'], wardrobe: ['polished casual', 'creator-native daywear'], gestures: ['product hold', 'natural face touch', 'conversational hand gesture'] },
  FASHION: { niches: ['Fashion', 'Style', 'Product review'], environments: ['bedroom', 'dressing area', 'city apartment'], wardrobe: ['contemporary fashion', 'streetwear', 'smart casual'], gestures: ['outfit reveal', 'fabric touch', 'conversational hand gesture'] },
  FITNESS: { niches: ['Fitness', 'Wellness', 'Lifestyle'], environments: ['home gym', 'bright apartment', 'outdoor fitness setting'], wardrobe: ['athleisure', 'training wear'], gestures: ['natural demonstration', 'confident point', 'relaxed hand gesture'] },
  WELLNESS: { niches: ['Wellness', 'Lifestyle', 'Self care'], environments: ['calm apartment', 'wellness room', 'bright home'], wardrobe: ['relaxed contemporary', 'athleisure'], gestures: ['calm hand gesture', 'product hold', 'natural emphasis'] },
  BUSINESS: { niches: ['Business', 'Founder', 'Productivity'], environments: ['home office', 'workspace', 'modern apartment'], wardrobe: ['smart casual', 'founder casual'], gestures: ['desk-side explanation', 'open-palm emphasis', 'natural point'] },
  TECH: { niches: ['Technology', 'SaaS', 'Productivity'], environments: ['home office', 'creator desk', 'modern workspace'], wardrobe: ['modern casual', 'smart casual'], gestures: ['device hold', 'screen-side explanation', 'natural hand gesture'] },
  SAAS: { niches: ['SaaS', 'Technology', 'Productivity'], environments: ['home office', 'creator desk', 'modern workspace'], wardrobe: ['modern casual', 'smart casual'], gestures: ['desk-side explanation', 'natural point', 'open-palm emphasis'] },
  ECOMMERCE: { niches: ['Ecommerce', 'Product review', 'Lifestyle'], environments: ['bright apartment', 'creator desk', 'living room'], wardrobe: ['creator casual', 'contemporary daywear'], gestures: ['product hold', 'unboxing gesture', 'natural recommendation'] },
  HOME: { niches: ['Home', 'Lifestyle', 'DIY'], environments: ['living room', 'kitchen', 'home workspace'], wardrobe: ['everyday casual', 'practical casual'], gestures: ['natural demonstration', 'open-palm emphasis', 'object interaction'] },
  FOOD: { niches: ['Food', 'Home', 'Lifestyle'], environments: ['kitchen', 'dining area', 'bright home'], wardrobe: ['everyday casual', 'kitchen-ready casual'], gestures: ['product hold', 'natural demonstration', 'taste reaction'] },
  TRAVEL: { niches: ['Travel', 'Lifestyle', 'Hospitality'], environments: ['hotel room', 'travel apartment', 'outdoor destination'], wardrobe: ['travel casual', 'summer casual'], gestures: ['natural point', 'bag or product hold', 'conversational gesture'] },
  AUTOMOTIVE: { niches: ['Automotive', 'Technology', 'Product review'], environments: ['driveway', 'garage', 'vehicle interior'], wardrobe: ['clean casual', 'practical casual'], gestures: ['feature point', 'object interaction', 'conversational gesture'] },
  FINANCE: { niches: ['Finance', 'Business', 'Education'], environments: ['home office', 'study', 'modern workspace'], wardrobe: ['smart casual', 'polished casual'], gestures: ['measured hand gesture', 'desk-side explanation', 'natural emphasis'] },
  EDUCATION: { niches: ['Education', 'Business', 'Productivity'], environments: ['study', 'home office', 'classroom-style workspace'], wardrobe: ['smart casual', 'professional casual'], gestures: ['explainer gesture', 'natural point', 'open-palm emphasis'] },
  PARENTING: { niches: ['Parenting', 'Home', 'Lifestyle'], environments: ['family living room', 'kitchen', 'bright home'], wardrobe: ['practical everyday', 'modern casual'], gestures: ['natural recommendation', 'object interaction', 'calm hand gesture'] },
  PETS: { niches: ['Pets', 'Lifestyle', 'Home'], environments: ['living room', 'garden', 'pet-friendly home'], wardrobe: ['everyday casual', 'relaxed casual'], gestures: ['natural interaction', 'product hold', 'playful gesture'] },
  LUXURY: { niches: ['Luxury', 'Lifestyle', 'Fashion'], environments: ['premium apartment', 'hotel lounge', 'bright interior'], wardrobe: ['elegant understated', 'premium casual'], gestures: ['measured hand gesture', 'product hold', 'subtle emphasis'] },
  LIFESTYLE: { niches: ['Lifestyle', 'Product review', 'Everyday living'], environments: ['bright apartment', 'living room', 'home kitchen'], wardrobe: ['contemporary casual', 'everyday creator style'], gestures: ['natural recommendation', 'product hold', 'conversational hand gesture'] },
  CUSTOM: { niches: ['Custom creator', 'Lifestyle'], environments: ['realistic everyday environment'], wardrobe: ['natural creator styling'], gestures: ['conversational hand gesture', 'natural emphasis'] }
});

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function parseJson(value, fallback) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '') : value;
    return parsed == null ? fallback : parsed;
  } catch (_) {
    return fallback;
  }
}

function uniq(values, max = 12) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 180)).filter(Boolean))].slice(0, max);
}

function categoryProfile(category) {
  return CATEGORY_PROFILES[clean(category || 'Custom', 80).toUpperCase()] || CATEGORY_PROFILES.CUSTOM;
}

function localeProfile(locale) {
  const normalized = clean(locale || 'en-GB', 30);
  const [language = 'en', region = 'GB'] = normalized.split('-');
  const languageName = language.toLowerCase() === 'en' ? 'English'
    : language.toLowerCase() === 'es' ? 'Spanish'
    : language.toLowerCase() === 'fr' ? 'French'
    : language.toLowerCase() === 'de' ? 'German'
    : language.toLowerCase() === 'it' ? 'Italian'
    : language.toLowerCase() === 'hi' ? 'Hindi'
    : language.toUpperCase();
  const accent = language.toLowerCase() !== 'en' ? region.toUpperCase()
    : region.toUpperCase() === 'US' ? 'American'
    : region.toUpperCase() === 'AU' ? 'Australian'
    : region.toUpperCase() === 'CA' ? 'Canadian'
    : 'British';
  return { locale: normalized, language: languageName, accent };
}

function defaultRouteCompatibility() {
  return [...ALL_CREATOR_ROUTES];
}

function buildProfile(input = {}) {
  const category = clean(input.category || 'Custom', 80) || 'Custom';
  const base = categoryProfile(category);
  const locale = localeProfile(input.locale);
  const environmentText = clean(input.environment, 800);
  const explicitEnvironmentTags = uniq(input.environmentTags, 10);
  const profile = {
    version: CREATOR_PROFILE_VERSION,
    presentation: clean(input.presentation || 'Unspecified', 80),
    ageBand: clean(input.ageBand || 'Adult', 80),
    locale: locale.locale,
    languages: uniq(input.languages?.length ? input.languages : [locale.language], 8),
    accent: clean(input.accent || locale.accent, 80),
    niches: uniq(input.niches?.length ? input.niches : [category, ...base.niches], 10),
    environments: uniq(explicitEnvironmentTags.length ? explicitEnvironmentTags : [environmentText, ...base.environments], 10),
    wardrobe: uniq(input.wardrobe?.length ? input.wardrobe : base.wardrobe, 10),
    gestures: uniq(input.gestures?.length ? input.gestures : base.gestures, 10),
    routeCompatibility: uniq(input.routeCompatibility?.length ? input.routeCompatibility : defaultRouteCompatibility(), 12),
    energy: uniq(input.energy?.length ? input.energy : ['NATURAL'], 5),
    referencePolicy: {
      master: 'PERSISTENT',
      alternates: 'PERSISTENT_OPTIONAL',
      regeneration: 'REPAIR_ONCE_NOT_PER_CAMPAIGN'
    }
  };
  return profile;
}

function profileFromRow(row = {}) {
  const casting = parseJson(row.castingProfileJson, {});
  return buildProfile({
    category: row.category,
    presentation: row.presentation || casting.presentation,
    ageBand: row.ageBand || casting.ageBand,
    locale: row.locale || casting.locale,
    languages: parseJson(row.languagesJson, casting.languages || []),
    accent: row.accent || casting.accent,
    niches: parseJson(row.nichesJson, casting.niches || []),
    environment: row.environment,
    environmentTags: parseJson(row.environmentTagsJson, casting.environments || []),
    wardrobe: parseJson(row.wardrobeJson, casting.wardrobe || []),
    gestures: parseJson(row.gestureJson, casting.gestures || []),
    routeCompatibility: parseJson(row.routeCompatibilityJson, casting.routeCompatibility || []).map(routeKey => routeKey === 'HAILUO_STANDARD_V1' ? CREATOR_ROUTE_KEYS.STANDARD : routeKey),
    energy: casting.energy || []
  });
}

function storageFields(profile) {
  return {
    creatorVersion: CREATOR_PROFILE_VERSION,
    accent: profile.accent,
    languagesJson: JSON.stringify(profile.languages),
    nichesJson: JSON.stringify(profile.niches),
    environmentTagsJson: JSON.stringify(profile.environments),
    wardrobeJson: JSON.stringify(profile.wardrobe),
    gestureJson: JSON.stringify(profile.gestures),
    routeCompatibilityJson: JSON.stringify(profile.routeCompatibility),
    castingProfileJson: JSON.stringify(profile)
  };
}

function requiredRoutesForQuality(quality) {
  return clean(quality, 30).toUpperCase() === 'PREMIUM'
    ? [CREATOR_ROUTE_KEYS.PREMIUM_CREATOR, CREATOR_ROUTE_KEYS.STANDARD]
    : [CREATOR_ROUTE_KEYS.STANDARD];
}

function supportsRoute(avatar, routeKey) {
  const profile = profileFromRow(avatar);
  return profile.routeCompatibility.includes(routeKey);
}

function tokenOverlap(left, right) {
  const a = new Set(clean(left, 1000).toLowerCase().split(/[^a-z0-9]+/).filter(value => value.length > 2));
  const b = new Set(clean(right, 1000).toLowerCase().split(/[^a-z0-9]+/).filter(value => value.length > 2));
  let score = 0;
  for (const token of a) if (b.has(token)) score += 1;
  return score;
}

function scoreCreator(avatar, desired = {}, options = {}) {
  const profile = profileFromRow(avatar);
  let score = 0;
  const reasons = [];
  const desiredCategory = clean(desired.category, 100);
  if (desiredCategory && clean(avatar.category, 100).toLowerCase() === desiredCategory.toLowerCase()) {
    score += 9; reasons.push('CATEGORY');
  }
  const nicheNeedle = [desiredCategory, ...(Array.isArray(desired.niches) ? desired.niches : [])].join(' ');
  const nicheOverlap = tokenOverlap(nicheNeedle, profile.niches.join(' '));
  if (nicheOverlap) { score += Math.min(6, nicheOverlap * 2); reasons.push('NICHE'); }

  const desiredLocale = clean(desired.locale, 30);
  if (desiredLocale && profile.locale.toLowerCase() === desiredLocale.toLowerCase()) {
    score += 4; reasons.push('LOCALE');
  } else if (desiredLocale && profile.locale.slice(0, 2).toLowerCase() === desiredLocale.slice(0, 2).toLowerCase()) {
    score += 2; reasons.push('LANGUAGE');
  }
  if (desired.presentation && clean(avatar.presentation, 80).toLowerCase() === clean(desired.presentation, 80).toLowerCase()) {
    score += 3; reasons.push('PRESENTATION');
  }
  if (desired.ageBand && clean(avatar.ageBand, 80).toLowerCase() === clean(desired.ageBand, 80).toLowerCase()) {
    score += 3; reasons.push('AGE_BAND');
  }
  const environmentOverlap = tokenOverlap(desired.environment, [avatar.environment, ...profile.environments].join(' '));
  if (environmentOverlap) { score += Math.min(4, environmentOverlap); reasons.push('ENVIRONMENT'); }
  const wardrobeOverlap = tokenOverlap(desired.wardrobeStyle, profile.wardrobe.join(' '));
  if (wardrobeOverlap) { score += Math.min(3, wardrobeOverlap); reasons.push('WARDROBE'); }
  const gestureOverlap = tokenOverlap(desired.gestureStyle, profile.gestures.join(' '));
  if (gestureOverlap) { score += Math.min(2, gestureOverlap); reasons.push('GESTURE'); }

  const requiredRoutes = requiredRoutesForQuality(options.quality);
  const routeCoverage = requiredRoutes.filter(routeKey => profile.routeCompatibility.includes(routeKey)).length;
  if (routeCoverage) { score += routeCoverage === requiredRoutes.length ? 5 : 2; reasons.push('ROUTE_COMPATIBILITY'); }
  else { score -= 40; reasons.push('ROUTE_INCOMPATIBLE'); }

  const repetition = Math.max(0, Number(options.repetition || 0));
  if (repetition) { score -= repetition * 6; reasons.push('DIVERSITY_PENALTY'); }
  if (avatar.scope === 'USER') { score += 1; reasons.push('SAVED_CREATOR'); }
  if (avatar.referenceStorageKey) { score += 1; reasons.push('REFERENCE_READY'); }

  return { score, reasons, profile };
}

function publicProfile(row = {}) {
  const profile = profileFromRow(row);
  return {
    version: CREATOR_PROFILE_VERSION,
    accent: profile.accent,
    languages: profile.languages,
    niches: profile.niches,
    environments: profile.environments,
    wardrobe: profile.wardrobe,
    gestures: profile.gestures,
    energy: profile.energy
  };
}

function actorSnapshot(row = {}) {
  const profile = profileFromRow(row);
  return {
    creatorVersion: CREATOR_PROFILE_VERSION,
    id: row.id || null,
    scope: row.scope || null,
    name: clean(row.name, 180),
    category: clean(row.category, 100),
    presentation: clean(row.presentation, 80),
    ageBand: clean(row.ageBand, 80),
    locale: profile.locale,
    languages: profile.languages,
    accent: profile.accent,
    niches: profile.niches,
    environments: profile.environments,
    wardrobe: profile.wardrobe,
    gestures: profile.gestures,
    routeCompatibility: profile.routeCompatibility,
    voice: clean(row.voice, 100),
    referenceVersion: Number(row.referenceVersion || 0),
    referenceQualityStatus: clean(row.referenceQualityStatus || (row.referenceStorageKey ? 'READY' : 'PENDING'), 40),
    referenceQualityScore: Number(row.referenceQualityScore || (row.referenceStorageKey ? 100 : 0)),
    alternateReferenceCount: Math.max(0, Number(row.alternateReferenceCount || 0))
  };
}

function referenceSummary(row = {}) {
  return {
    master: {
      ready: Boolean(row.referenceStorageKey),
      version: Number(row.referenceVersion || 0),
      qualityStatus: clean(row.referenceQualityStatus || (row.referenceStorageKey ? 'READY' : 'PENDING'), 40),
      qualityScore: Number(row.referenceQualityScore || (row.referenceStorageKey ? 100 : 0))
    },
    alternateCount: Math.max(0, Number(row.alternateReferenceCount || 0)),
    policy: 'PERSISTENT_REUSE'
  };
}

function creatorSystemSnapshot() {
  return {
    version: CREATOR_PROFILE_VERSION,
    routes: [...ALL_CREATOR_ROUTES],
    masterReference: 'UGCAvatar.referenceStorage*',
    alternateReferences: 'UGCAvatarReference',
    casting: 'DETERMINISTIC_PROFILE_SCORE_V2',
    regenerationPolicy: 'REPAIR_ONCE_NOT_PER_CAMPAIGN'
  };
}

module.exports = {
  CREATOR_PROFILE_VERSION,
  CREATOR_ROUTE_KEYS,
  ALL_CREATOR_ROUTES,
  buildProfile,
  profileFromRow,
  storageFields,
  requiredRoutesForQuality,
  supportsRoute,
  scoreCreator,
  publicProfile,
  actorSnapshot,
  referenceSummary,
  creatorSystemSnapshot
};
