const postStudio = require('./aiPostStudioService');
const creators = require('./ugcCreatorEngine');

const SKILLS_VERSION = 'ugc-skills-v1';

const SCRIPT_BUDGETS = Object.freeze({
  15: Object.freeze({ targetMin: 28, targetMax: 34, hardMax: 36, reserveSeconds: 0.45 }),
  20: Object.freeze({ targetMin: 38, targetMax: 46, hardMax: 49, reserveSeconds: 0.45 }),
  30: Object.freeze({ targetMin: 58, targetMax: 66, hardMax: 70, reserveSeconds: 0.55 })
});

const ALLOWED_KINDS = new Set(['CREATOR', 'PRODUCT', 'LIFESTYLE', 'CTA']);

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function wordCount(value) {
  return clean(value, 20000).split(/\s+/).filter(Boolean).length;
}

function words(value) {
  return clean(value, 20000).split(/\s+/).filter(Boolean);
}

function sentenceChunks(value) {
  const text = clean(value, 20000);
  if (!text) return [];
  const chunks = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  return chunks.map(item => item.trim()).filter(Boolean);
}

function trimScriptAtSentenceBoundary(value, hardMax) {
  const input = clean(value, 12000);
  if (wordCount(input) <= hardMax) return input;
  const sentences = sentenceChunks(input);
  const accepted = [];
  let used = 0;
  for (const sentence of sentences) {
    const count = wordCount(sentence);
    if (used + count > hardMax) break;
    accepted.push(sentence);
    used += count;
  }
  if (accepted.length) return accepted.join(' ').trim();
  const clipped = words(input).slice(0, hardMax).join(' ');
  return clipped ? clipped.replace(/[,:;\-]+$/, '') + '.' : '';
}

function overlapScore(left, right) {
  const a = new Set(clean(left, 2000).toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2));
  const b = new Set(clean(right, 2000).toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 2));
  let score = 0;
  for (const token of a) if (b.has(token)) score += 1;
  return score;
}

function brandUnderstandingSkill({ input, brand, productAssetIds = [], resolvedType }) {
  const sourceType = clean(input.sourceType || (productAssetIds.length ? 'PRODUCT' : input.productUrl ? 'WEBSITE' : 'BRIEF'), 30).toUpperCase();
  const offerType = clean(brand?.analysis?.offerType || (resolvedType === 'PRODUCT_SHOWCASE' ? 'PRODUCT' : 'BRAND'), 40).toUpperCase();
  const verifiedClaims = Array.isArray(brand?.verifiedClaims) ? brand.verifiedClaims.map(item => clean(item, 500)).filter(Boolean).slice(0, 20) : [];
  const audience = Array.isArray(brand?.audience) ? brand.audience.map(item => clean(item, 300)).filter(Boolean).slice(0, 10) : [];
  const directions = Array.isArray(brand?.analysis?.ugcDirections) ? brand.analysis.ugcDirections.map(item => clean(item, 500)).filter(Boolean).slice(0, 12) : [];
  return {
    skill: 'BRAND_UNDERSTANDING',
    version: SKILLS_VERSION,
    sourceType,
    offerType,
    brandName: clean(brand?.name, 180),
    productName: clean(brand?.productName, 220),
    summary: clean(brand?.summary || input.productDescription, 2200),
    audience,
    verifiedClaims,
    creativeDirections: directions,
    productAssetCount: productAssetIds.length,
    productInteractionUseful: brand?.analysis?.productInteractionUseful !== false,
    evidencePolicy: {
      claims: 'VERIFIED_ONLY',
      canInferCreativeFraming: true,
      forbidden: ['invented_price', 'invented_testimonial', 'invented_statistic', 'invented_certification', 'invented_feature']
    }
  };
}

function creativeDirectorSkillFallback({ input, brandSkill, resolvedType, variationCount }) {
  const offer = brandSkill.productName || brandSkill.brandName || clean(input.productDescription, 500) || 'this product';
  const summary = brandSkill.summary || 'It helps solve a practical everyday problem.';
  const angles = ['Problem to solution', 'Personal discovery', 'Benefit-led recommendation', 'Quick demonstration', 'Why it is useful'];
  return {
    skill: 'CREATIVE_DIRECTOR',
    version: SKILLS_VERSION,
    campaignTitle: (brandSkill.brandName || 'UGC') + ' Campaign',
    strategy: {
      format: resolvedType,
      objective: resolvedType === 'PRODUCT_SHOWCASE' ? 'Show the product naturally and explain why it matters.' : 'Explain the offer naturally through a credible creator.',
      pacing: 'CONVERSATIONAL',
      cameraStyle: 'CREATOR_NATIVE',
      angleMix: angles.slice(0, Math.min(variationCount, angles.length))
    },
    ads: Array.from({ length: variationCount }, (_, index) => {
      const angle = angles[index % angles.length];
      const hook = resolvedType === 'PRODUCT_SHOWCASE'
        ? 'I did not expect this to be this useful until I tried it.'
        : 'Here is the simple reason this is worth knowing about.';
      const script = clean(hook + ' ' + offer + ' — ' + summary + ' Take a closer look and see whether it fits what you need.', 12000);
      return {
        title: 'UGC Ad ' + (index + 1),
        angle,
        hook,
        script,
        cta: 'Take a closer look.',
        caption: script,
        creatorProfile: { category: '', presentation: '', ageBand: '', locale: '', environment: '', energy: 'NATURAL' },
        scenes: []
      };
    })
  };
}

async function creativeDirectorSkill({ input, brandSkill, avatars, resolvedType, variationCount, providerDurations, playbackDurations }) {
  const timing = scriptTimingSpec(input.duration);
  const evidence = {
    brandName: brandSkill.brandName,
    productName: brandSkill.productName,
    summary: brandSkill.summary,
    audience: brandSkill.audience,
    verifiedClaims: brandSkill.verifiedClaims,
    offerType: brandSkill.offerType,
    productAssetCount: brandSkill.productAssetCount,
    productInteractionUseful: brandSkill.productInteractionUseful,
    creativeDirections: brandSkill.creativeDirections
  };

  try {
    const parsed = await postStudio.callChatModel(postStudio.REASONING_MODEL, [
      {
        role: 'system',
        content: [
          'You are the structured UGC Creative Director skill inside INXSocial.',
          'Return JSON only. Do not return markdown, commentary or prose outside the JSON object.',
          'Use only verified evidence supplied by the user or brand analysis. Never invent prices, testimonials, statistics, certifications, product claims or software features.',
          'The customer should not need to write a script or design scenes.',
          'Every requested variation must have a materially different hook and angle while remaining truthful.',
          'AVATAR_EXPLAINER keeps a believable creator as the visual anchor and is preferred for SaaS, websites, apps and services. Never invent fake application screens.',
          'PRODUCT_SHOWCASE may combine creator footage with supplied product references. Never redesign packaging or substitute a different product.',
          'Write natural creator speech, not corporate copy. Do not use exaggerated hype or fake personal experience.',
          `For ${Number(input.duration)} seconds, target ${timing.targetMin}-${timing.targetMax} spoken words and never exceed ${timing.hardMax} words.`,
          'The final sentence and CTA must finish before the requested duration, leaving a short visual tail.',
          'Use one creator identity and one voice per ad.',
          'creatorProfile is a casting preference, not a named person. Do not request resemblance to a celebrity or identifiable real person.',
          'For each scene, objective describes what the scene must communicate and visualDirection describes what should be filmed. Do not include model/provider names.',
          'Return exactly this shape: {"campaignTitle":"string","strategy":{"format":"string","objective":"string","pacing":"CONVERSATIONAL|ENERGETIC|CALM","cameraStyle":"CREATOR_NATIVE|PRODUCT_DEMO|HYBRID","angleMix":["string"]},"ads":[{"title":"string","angle":"string","hook":"string","script":"string","cta":"string","caption":"string","creatorProfile":{"category":"string","presentation":"string","ageBand":"string","locale":"string","environment":"string","niches":["string"],"wardrobeStyle":"string","gestureStyle":"string","energy":"NATURAL|ENERGETIC|CALM"},"scenes":[{"kind":"CREATOR|PRODUCT|LIFESTYLE|CTA","objective":"string","visualDirection":"string"}]}]}'
        ].join('\n\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          evidence,
          requested: {
            campaignType: resolvedType,
            duration: Number(input.duration),
            variationCount,
            quality: clean(input.quality || 'STANDARD', 30).toUpperCase(),
            notes: clean(input.notes, 1200)
          },
          timing: {
            providerDurations,
            playbackDurations,
            totalPlaybackSeconds: playbackDurations.reduce((sum, value) => sum + Number(value || 0), 0)
          },
          creatorLibrary: {
            count: avatars.length,
            categories: [...new Set(avatars.map(avatar => clean(avatar.category, 100)).filter(Boolean))],
            presentations: [...new Set(avatars.map(avatar => clean(avatar.presentation, 80)).filter(Boolean))],
            ageBands: [...new Set(avatars.map(avatar => clean(avatar.ageBand, 80)).filter(Boolean))],
            locales: [...new Set(avatars.map(avatar => clean(avatar.locale, 30)).filter(Boolean))],
            accents: [...new Set(avatars.map(avatar => creators.publicProfile(avatar).accent).filter(Boolean))],
            niches: [...new Set(avatars.flatMap(avatar => creators.publicProfile(avatar).niches))].slice(0, 40)
          }
        })
      }
    ], {
      reasoningEffort: 'high',
      temperature: 0.3,
      maxTokens: Math.max(3600, variationCount * 950),
      timeoutMs: 180000
    });

    if (!parsed || !Array.isArray(parsed.ads) || parsed.ads.length !== variationCount) {
      throw new Error('Creative Director returned an invalid variation count.');
    }
    return {
      skill: 'CREATIVE_DIRECTOR',
      version: SKILLS_VERSION,
      campaignTitle: clean(parsed.campaignTitle || (brandSkill.brandName || 'UGC') + ' Campaign', 180),
      strategy: {
        format: clean(parsed.strategy?.format || resolvedType, 60).toUpperCase(),
        objective: clean(parsed.strategy?.objective, 600),
        pacing: ['CONVERSATIONAL', 'ENERGETIC', 'CALM'].includes(String(parsed.strategy?.pacing).toUpperCase()) ? String(parsed.strategy.pacing).toUpperCase() : 'CONVERSATIONAL',
        cameraStyle: ['CREATOR_NATIVE', 'PRODUCT_DEMO', 'HYBRID'].includes(String(parsed.strategy?.cameraStyle).toUpperCase()) ? String(parsed.strategy.cameraStyle).toUpperCase() : (resolvedType === 'PRODUCT_SHOWCASE' ? 'HYBRID' : 'CREATOR_NATIVE'),
        angleMix: Array.isArray(parsed.strategy?.angleMix) ? parsed.strategy.angleMix.map(item => clean(item, 180)).filter(Boolean).slice(0, variationCount) : []
      },
      ads: parsed.ads.map((ad, index) => ({
        title: clean(ad.title || 'UGC Ad ' + (index + 1), 180),
        angle: clean(ad.angle || 'Creator recommendation', 240),
        hook: clean(ad.hook, 500),
        script: clean(ad.script, 12000),
        cta: clean(ad.cta, 500),
        caption: clean(ad.caption || ad.script, 10000),
        creatorProfile: {
          category: clean(ad.creatorProfile?.category, 100),
          presentation: clean(ad.creatorProfile?.presentation, 80),
          ageBand: clean(ad.creatorProfile?.ageBand, 80),
          locale: clean(ad.creatorProfile?.locale, 30),
          environment: clean(ad.creatorProfile?.environment, 400),
          niches: Array.isArray(ad.creatorProfile?.niches) ? ad.creatorProfile.niches.map(item => clean(item, 100)).filter(Boolean).slice(0, 8) : [],
          wardrobeStyle: clean(ad.creatorProfile?.wardrobeStyle, 160),
          gestureStyle: clean(ad.creatorProfile?.gestureStyle, 160),
          energy: ['NATURAL', 'ENERGETIC', 'CALM'].includes(String(ad.creatorProfile?.energy).toUpperCase()) ? String(ad.creatorProfile.energy).toUpperCase() : 'NATURAL'
        },
        scenes: Array.isArray(ad.scenes) ? ad.scenes.map(scene => ({
          kind: ALLOWED_KINDS.has(String(scene.kind).toUpperCase()) ? String(scene.kind).toUpperCase() : 'CREATOR',
          objective: clean(scene.objective, 600),
          visualDirection: clean(scene.visualDirection, 1800)
        })).slice(0, Math.max(providerDurations.length, 1)) : []
      }))
    };
  } catch (error) {
    console.warn('[UGC SKILL FALLBACK]', 'Creative Director:', clean(error?.message, 400));
    return creativeDirectorSkillFallback({ input, brandSkill, resolvedType, variationCount });
  }
}

function scriptTimingSpec(duration) {
  const seconds = Number(duration);
  const budget = SCRIPT_BUDGETS[seconds] || SCRIPT_BUDGETS[15];
  return {
    skill: 'SCRIPT_TIMING',
    version: SKILLS_VERSION,
    targetDuration: seconds,
    targetMin: budget.targetMin,
    targetMax: budget.targetMax,
    hardMax: budget.hardMax,
    reserveSeconds: budget.reserveSeconds,
    maxSpeechRateMultiplier: 1.3,
    minSpeechRateMultiplier: 1,
    closingRule: 'SPEECH_FINISHES_BEFORE_CUT'
  };
}

function scriptTimingSkill({ script, duration, cta = '' }) {
  const spec = scriptTimingSpec(duration);
  const original = clean(script, 12000);
  const normalizedCta = clean(cta, 500);
  let normalized = trimScriptAtSentenceBoundary(original, spec.hardMax);

  if (normalizedCta && !normalized.toLowerCase().includes(normalizedCta.toLowerCase())) {
    const ctaWords = wordCount(normalizedCta);
    const currentWords = wordCount(normalized);
    if (currentWords + ctaWords <= spec.hardMax) {
      normalized = clean(normalized + ' ' + normalizedCta, 12000);
    } else if (ctaWords < spec.hardMax) {
      const bodyBudget = Math.max(1, spec.hardMax - ctaWords);
      normalized = clean(trimScriptAtSentenceBoundary(original, bodyBudget) + ' ' + normalizedCta, 12000);
    }
  }

  const finalCount = wordCount(normalized);
  return {
    ...spec,
    originalWordCount: wordCount(original),
    finalWordCount: finalCount,
    withinTarget: finalCount >= spec.targetMin && finalCount <= spec.targetMax,
    wasTrimmed: normalized !== original,
    script: normalized,
    cta: normalizedCta,
    spokenCtaIncluded: !normalizedCta || normalized.toLowerCase().includes(normalizedCta.toLowerCase())
  };
}

function creatorCastingSkill({ ads, avatars, creatorMode, selectedAvatarId, quality = 'STANDARD' }) {
  const selected = creatorMode === 'SELECTED' && selectedAvatarId
    ? avatars.find(avatar => avatar.id === selectedAvatarId)
    : null;
  const used = new Map();
  const assignments = ads.map((ad, index) => {
    if (selected) {
      const internalProfile = creators.profileFromRow(selected);
      const requiredRoutes = creators.requiredRoutesForQuality(quality);
      const routeCompatible = requiredRoutes.some(routeKey => internalProfile.routeCompatibility.includes(routeKey));
      return {
        adSequence: index + 1,
        avatarIndex: Math.max(0, avatars.indexOf(selected)),
        avatarId: selected.id,
        score: 999,
        reason: routeCompatible ? ['USER_SELECTED', 'ROUTE_COMPATIBILITY'] : ['USER_SELECTED', 'ROUTE_INCOMPATIBLE'],
        routeCompatible,
        creatorVersion: creators.CREATOR_PROFILE_VERSION,
        profile: creators.publicProfile(selected)
      };
    }
    const desired = ad.creatorProfile || {};
    const scored = avatars.map((avatar, avatarIndex) => {
      const result = creators.scoreCreator(avatar, desired, {
        quality,
        repetition: used.get(avatar.id) || 0
      });
      return {
        avatarIndex,
        avatarId: avatar.id,
        score: result.score,
        reasons: result.reasons,
        profile: result.profile
      };
    }).sort((a, b) => b.score - a.score || a.avatarIndex - b.avatarIndex);

    const fallbackIndex = index % Math.max(1, avatars.length);
    const chosen = scored[0] || {
      avatarIndex: fallbackIndex,
      avatarId: avatars[fallbackIndex]?.id || null,
      score: 0,
      reasons: ['FALLBACK'],
      profile: avatars[fallbackIndex] ? creators.profileFromRow(avatars[fallbackIndex]) : null
    };
    if (chosen.avatarId) used.set(chosen.avatarId, (used.get(chosen.avatarId) || 0) + 1);
    const chosenAvatar = avatars[chosen.avatarIndex] || null;
    return {
      adSequence: index + 1,
      avatarIndex: chosen.avatarIndex,
      avatarId: chosen.avatarId,
      score: chosen.score,
      reason: chosen.reasons,
      routeCompatible: !chosen.reasons.includes('ROUTE_INCOMPATIBLE'),
      creatorVersion: creators.CREATOR_PROFILE_VERSION,
      profile: chosenAvatar ? creators.publicProfile(chosenAvatar) : null
    };
  });
  return {
    skill: 'CREATOR_CASTING',
    version: SKILLS_VERSION,
    creatorVersion: creators.CREATOR_PROFILE_VERSION,
    mode: selected ? 'USER_SELECTED' : 'AUTO',
    assignments
  };
}

function scenePlanningSkill({ resolvedType, providerDurations, playbackDurations, rawScenes = [] }) {
  const count = providerDurations.length;
  const defaultKinds = resolvedType === 'AVATAR_EXPLAINER'
    ? Array.from({ length: count }, () => 'CREATOR')
    : count === 1 ? ['PRODUCT'] : count === 2 ? ['CREATOR', 'PRODUCT'] : Array.from({ length: count }, (_, index) => index === 0 || index === count - 1 ? 'CREATOR' : 'PRODUCT');
  const scenes = providerDurations.map((providerDuration, index) => {
    const raw = rawScenes[index] || {};
    const requested = ALLOWED_KINDS.has(String(raw.kind).toUpperCase()) ? String(raw.kind).toUpperCase() : defaultKinds[index];
    const kind = resolvedType === 'AVATAR_EXPLAINER' ? 'CREATOR' : requested;
    return {
      sequence: index + 1,
      kind,
      objective: clean(raw.objective, 600) || (kind === 'CREATOR' ? 'Advance the spoken recommendation naturally.' : 'Show the product clearly and truthfully.'),
      visualDirection: clean(raw.visualDirection, 1800),
      providerDuration: Number(providerDuration),
      playbackDuration: Number(playbackDurations[index] || providerDuration)
    };
  });
  return {
    skill: 'SCENE_PLANNING',
    version: SKILLS_VERSION,
    campaignType: resolvedType,
    sceneCount: scenes.length,
    scenes
  };
}

function creatorConsistencySkill({ avatar, campaignType }) {
  const profile = avatar ? creators.publicProfile(avatar) : null;
  return {
    skill: 'CREATOR_CONSISTENCY',
    version: SKILLS_VERSION,
    actorId: avatar?.id || null,
    identityLock: 'EXACT_REFERENCE',
    presentation: clean(avatar?.presentation || profile?.presentation, 80),
    adultAgeBand: clean(avatar?.ageBand || profile?.ageBand, 80),
    preferredEnvironments: profile?.environments?.slice(0, 3) || [],
    wardrobeProfile: profile?.wardrobe?.slice(0, 3) || [],
    gestureProfile: profile?.gestures?.slice(0, 3) || [],
    preserve: ['face_shape', 'skin_tone', 'age', 'hair', 'wardrobe', 'voice_identity'],
    environmentContinuity: campaignType === 'AVATAR_EXPLAINER' ? 'STRICT' : 'SESSION_MATCH',
    wardrobeContinuity: 'PRESERVE_REFERENCE_WITHIN_AD',
    prohibit: ['identity_morph', 'second_person', 'wardrobe_drift', 'face_replacement', 'celebrity_resemblance']
  };
}

function voiceConsistencySkill({ avatar, timing }) {
  const profile = avatar ? creators.publicProfile(avatar) : null;
  return {
    skill: 'VOICE_CONSISTENCY',
    version: SKILLS_VERSION,
    voice: clean(avatar?.voice, 100),
    locale: clean(avatar?.locale, 30) || 'en-GB',
    accent: clean(profile?.accent, 80),
    languages: profile?.languages?.slice(0, 4) || [],
    delivery: 'NATURAL_CONVERSATIONAL',
    minSpeedMultiplier: timing.minSpeechRateMultiplier,
    maxSpeedMultiplier: timing.maxSpeechRateMultiplier,
    prohibit: ['announcer_cadence', 'voice_switch_between_scenes', 'slow_motion_speech']
  };
}

function productFidelitySkill({ hasProductReference }) {
  return {
    skill: 'PRODUCT_FIDELITY',
    version: SKILLS_VERSION,
    referenceRequired: Boolean(hasProductReference),
    referencePolicy: hasProductReference ? 'EXACT_PRODUCT_REFERENCE' : 'NO_PRODUCT_CLAIM',
    preserve: ['geometry', 'packaging', 'colour', 'proportion', 'visible_branding', 'scale'],
    prohibit: ['substitute_product', 'invented_packaging', 'floating_object', 'impossible_grip', 'invented_text']
  };
}

function naturalMotionSkill({ energy = 'NATURAL' }) {
  return {
    skill: 'NATURAL_MOTION',
    version: SKILLS_VERSION,
    temporalSpeed: 'REAL_TIME_1X',
    energy: ['NATURAL', 'ENERGETIC', 'CALM'].includes(String(energy).toUpperCase()) ? String(energy).toUpperCase() : 'NATURAL',
    required: ['natural_blinking', 'breathing', 'responsive_eye_contact', 'conversational_head_motion', 'purposeful_gestures'],
    prohibit: ['slow_motion', 'time_stretch', 'frozen_pose', 'excessive_gesturing', 'rubber_hands']
  };
}

function cameraStyleSkill({ campaignType, strategy }) {
  return {
    skill: 'CAMERA_STYLE',
    version: SKILLS_VERSION,
    style: strategy?.cameraStyle || (campaignType === 'PRODUCT_SHOWCASE' ? 'HYBRID' : 'CREATOR_NATIVE'),
    orientation: 'VERTICAL_9_16',
    captureLook: 'SMARTPHONE_REALISM',
    movement: campaignType === 'PRODUCT_SHOWCASE' ? 'SUBTLE_HANDHELD_OR_LOCKED' : 'SUBTLE_HANDHELD',
    exposure: 'NATURAL',
    depth: 'REAL_ROOM_DEPTH',
    prohibit: ['glossy_cgi', 'beauty_filter', 'impossible_depth', 'generated_overlay_text']
  };
}

function adFinishingSkill({ duration, captionsEnabled = true, musicMode = 'AUTO' }) {
  return {
    skill: 'AD_FINISHING',
    version: SKILLS_VERSION,
    exactDurationSeconds: Number(duration),
    speechTailSeconds: (SCRIPT_BUDGETS[Number(duration)] || SCRIPT_BUDGETS[15]).reserveSeconds,
    captions: captionsEnabled ? 'BURNED_IN_AFTER_ASSEMBLY' : 'OFF',
    music: clean(musicMode || 'AUTO', 20).toUpperCase(),
    audio: {
      narrationPriority: true,
      normalizeNarration: true,
      preventFinalWordCutoff: true
    },
    output: { resolution: '720p', aspectRatio: '9:16', container: 'MP4' }
  };
}

function qualityControlSkill({ resolvedType, timing, scenePlan, avatar, hasProductReference, castingDecision = null }) {
  const hasCreatorScene = scenePlan.scenes.some(scene => scene.kind === 'CREATOR');
  const checks = [
    { id: 'SCRIPT_COMPLETION', status: timing.finalWordCount <= timing.hardMax ? 'PASS' : 'FAIL', detail: { words: timing.finalWordCount, hardMax: timing.hardMax } },
    { id: 'DURATION_EXACTNESS', status: Math.abs(scenePlan.scenes.reduce((sum, scene) => sum + scene.playbackDuration, 0) - timing.targetDuration) < 0.001 ? 'PASS' : 'FAIL' },
    { id: 'IDENTITY_CONSISTENCY', status: hasCreatorScene && !avatar ? 'FAIL' : 'PASS' },
    { id: 'CREATOR_ROUTE_COMPATIBILITY', status: hasCreatorScene && castingDecision?.routeCompatible === false ? 'FAIL' : 'PASS' },
    { id: 'PRODUCT_REFERENCE', status: resolvedType === 'PRODUCT_SHOWCASE' && scenePlan.scenes.some(scene => scene.kind === 'PRODUCT') && !hasProductReference ? 'FAIL' : 'PASS' }
  ];
  const failed = checks.filter(check => check.status === 'FAIL');
  return {
    skill: 'QUALITY_CONTROL_PREFLIGHT',
    version: SKILLS_VERSION,
    status: failed.length ? 'FAIL' : 'PASS',
    checks,
    failedChecks: failed.map(check => check.id)
  };
}

function directiveText(value) {
  if (!value) return '';
  const entries = [];
  for (const [key, item] of Object.entries(value)) {
    if (['skill', 'version', 'actorId'].includes(key)) continue;
    if (Array.isArray(item)) entries.push(key + ': ' + item.join(', '));
    else if (item && typeof item === 'object') entries.push(key + ': ' + Object.entries(item).map(([k,v]) => k + '=' + v).join(', '));
    else if (item !== '' && item != null) entries.push(key + ': ' + item);
  }
  return entries.join('. ');
}

function compileScenePrompt({ scene, consistency, productFidelity, motion, camera }) {
  const base = clean(scene.visualDirection || scene.objective, 1800) || (scene.kind === 'PRODUCT'
    ? 'Show the supplied product naturally in a believable everyday context.'
    : 'Creator speaks directly to camera in a believable everyday environment.');
  const relevant = scene.kind === 'PRODUCT' ? productFidelity : consistency;
  return clean([
    base,
    directiveText(relevant),
    directiveText(motion),
    directiveText(camera),
    'No generated subtitles, watermarks, labels or extra readable overlay text.'
  ].filter(Boolean).join('\n\n'), 5000);
}

async function planCampaign({
  input,
  brand,
  avatars,
  resolvedType,
  productAssetIds = [],
  providerDurations,
  playbackDurations
}) {
  const brandSkill = brandUnderstandingSkill({ input, brand, productAssetIds, resolvedType });
  const director = await creativeDirectorSkill({
    input,
    brandSkill,
    avatars,
    resolvedType,
    variationCount: Number(input.adCount),
    providerDurations,
    playbackDurations
  });
  const casting = creatorCastingSkill({
    ads: director.ads,
    avatars,
    creatorMode: input.creatorMode,
    selectedAvatarId: input.avatarId,
    quality: input.quality
  });
  const hasProductReference = Boolean(productAssetIds.length || (Array.isArray(brand?.brandReferences) && brand.brandReferences.length));

  const ads = director.ads.map((rawAd, index) => {
    const timing = scriptTimingSkill({ script: rawAd.script, duration: input.duration, cta: rawAd.cta });
    const assignment = casting.assignments[index] || casting.assignments[0];
    const avatar = avatars[assignment?.avatarIndex ?? 0] || avatars[0] || null;
    const scenePlan = scenePlanningSkill({
      resolvedType,
      providerDurations,
      playbackDurations,
      rawScenes: rawAd.scenes
    });
    const consistency = creatorConsistencySkill({ avatar, campaignType: resolvedType });
    const voice = voiceConsistencySkill({ avatar, timing });
    const productFidelity = productFidelitySkill({ hasProductReference });
    const motion = naturalMotionSkill({ energy: rawAd.creatorProfile?.energy });
    const camera = cameraStyleSkill({ campaignType: resolvedType, strategy: director.strategy });
    const finishing = adFinishingSkill({ duration: input.duration, captionsEnabled: true, musicMode: 'AUTO' });
    const qc = qualityControlSkill({ resolvedType, timing, scenePlan, avatar, hasProductReference, castingDecision: assignment });
    if (qc.status === 'FAIL') {
      const error = new Error('UGC skill preflight failed: ' + qc.failedChecks.join(', '));
      error.code = 'UGC_SKILL_PREFLIGHT_FAILED';
      error.preflight = qc;
      throw error;
    }

    const parts = splitScriptByWeightedDuration(timing.script, scenePlan.scenes.map(scene => scene.playbackDuration));
    return {
      title: rawAd.title || 'UGC Ad ' + (index + 1),
      angle: rawAd.angle || 'Creator recommendation',
      hook: rawAd.hook,
      script: timing.script,
      cta: rawAd.cta,
      caption: rawAd.caption || timing.script,
      avatarIndex: assignment?.avatarIndex ?? (index % Math.max(1, avatars.length)),
      skillDecisions: {
        timing,
        creatorCasting: assignment,
        creatorConsistency: consistency,
        voiceConsistency: voice,
        productFidelity,
        naturalMotion: motion,
        cameraStyle: camera,
        finishing,
        preflight: qc
      },
      scenes: scenePlan.scenes.map((scene, sceneIndex) => ({
        sequence: scene.sequence,
        duration: scene.providerDuration,
        playbackDuration: scene.playbackDuration,
        kind: scene.kind,
        objective: scene.objective,
        prompt: compileScenePrompt({ scene, consistency, productFidelity, motion, camera }),
        script: parts[sceneIndex] || ''
      }))
    };
  });

  return {
    title: director.campaignTitle,
    campaignType: resolvedType,
    skillsVersion: SKILLS_VERSION,
    skillDecisions: {
      brandUnderstanding: brandSkill,
      creativeDirector: director.strategy,
      creatorCasting: casting,
      scriptTiming: scriptTimingSpec(input.duration),
      scenePlanning: {
        providerDurations: providerDurations.map(Number),
        playbackDurations: playbackDurations.map(Number),
        requestedDuration: Number(input.duration)
      },
      productFidelity: productFidelitySkill({ hasProductReference }),
      cameraStyle: cameraStyleSkill({ campaignType: resolvedType, strategy: director.strategy }),
      finishing: adFinishingSkill({ duration: input.duration, captionsEnabled: true, musicMode: 'AUTO' })
    },
    ads
  };
}

function splitScriptByWeightedDuration(script, durations) {
  const tokens = words(script);
  if (!tokens.length) return durations.map(() => '');
  let cursor = 0;
  return durations.map((duration, index) => {
    const remainingWords = tokens.length - cursor;
    const remainingDuration = durations.slice(index).reduce((sum, value) => sum + Number(value || 0), 0);
    const take = index === durations.length - 1
      ? remainingWords
      : Math.max(1, Math.round(remainingWords * Number(duration || 0) / Math.max(1, remainingDuration)));
    const part = tokens.slice(cursor, cursor + take).join(' ');
    cursor += take;
    return part;
  });
}

module.exports = {
  SKILLS_VERSION,
  SCRIPT_BUDGETS,
  brandUnderstandingSkill,
  creativeDirectorSkill,
  creatorCastingSkill,
  scriptTimingSpec,
  scriptTimingSkill,
  scenePlanningSkill,
  creatorConsistencySkill,
  voiceConsistencySkill,
  productFidelitySkill,
  naturalMotionSkill,
  cameraStyleSkill,
  adFinishingSkill,
  qualityControlSkill,
  compileScenePrompt,
  splitScriptByWeightedDuration,
  planCampaign
};
