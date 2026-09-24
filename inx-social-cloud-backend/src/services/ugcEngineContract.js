const crypto = require('node:crypto');
const registry = require('./ugcEngineRegistry');
const router = require('./ugcModelRouter');
const creators = require('./ugcCreatorEngine');

const QC_CHECKS = Object.freeze([
  'IDENTITY_CONSISTENCY',
  'VOICE_CONSISTENCY',
  'SCRIPT_COMPLETION',
  'DURATION_EXACTNESS',
  'PRODUCT_FIDELITY',
  'ANATOMY_AND_HANDS',
  'LIP_SYNC',
  'AUDIO_LEVELS',
  'CAPTION_TIMING'
]);

function clean(value, max = 4000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function playbackDurations(totalDuration, providerDurations) {
  let remaining = Math.max(0, Number(totalDuration) || 0);
  return providerDurations.map(value => {
    const providerDuration = Math.max(0, Number(value) || 0);
    const usable = Math.max(0, Math.min(providerDuration, remaining));
    remaining = Math.max(0, remaining - usable);
    return usable;
  });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function actorSnapshot(avatar) {
  return avatar ? creators.actorSnapshot(avatar) : null;
}

function buildEngineProject({
  userId,
  campaignId,
  input,
  brand,
  productAssetIds = [],
  availableAvatars = [],
  plan,
  resolvedType,
  perAdCredits,
  totalCredits
}) {
  if (!campaignId || !userId) throw new Error('UGC engine project requires campaign and user identifiers.');
  if (!plan || !Array.isArray(plan.ads) || !plan.ads.length) throw new Error('UGC engine project requires a production plan.');

  const targetDuration = Number(input.duration);
  const ads = plan.ads.map((ad, adIndex) => {
    const avatar = availableAvatars[Number(ad.avatarIndex || adIndex) % Math.max(1, availableAvatars.length)] || availableAvatars[0] || null;
    const providerDurations = (ad.scenes || []).map(scene => Number(scene.duration));
    const finalDurations = playbackDurations(targetDuration, providerDurations);
    const scenes = (ad.scenes || []).map((scene, sceneIndex) => {
      const routeDecision = scene.routeDecision && typeof scene.routeDecision === 'object'
        ? scene.routeDecision
        : router.routeForScene({
            quality: input.quality,
            kind: scene.kind,
            providerDuration: providerDurations[sceneIndex],
            playbackDuration: finalDurations[sceneIndex],
            hasActor: Boolean(avatar),
            hasProductReference: Boolean(productAssetIds.length || (Array.isArray(brand?.brandReferences) && brand.brandReferences.length)),
            hasNarration: clean(scene.script, 4000).length >= 2,
            allowedRoutes: avatar && ['CREATOR','CTA'].includes(clean(scene.kind || 'CREATOR', 40).toUpperCase())
              ? creators.profileFromRow(avatar).routeCompatibility
              : null
          });
      return {
        sequence: sceneIndex + 1,
        purpose: clean(scene.kind || 'CREATOR', 40).toUpperCase(),
        kind: clean(scene.kind || 'CREATOR', 40).toUpperCase(),
        providerDuration: providerDurations[sceneIndex],
        playbackDuration: finalDurations[sceneIndex],
        script: clean(scene.script, 4000),
        prompt: clean(scene.prompt, 5000),
        actorId: avatar?.id || null,
        productAssetIds: [...productAssetIds],
        route: routeDecision
      };
    });

    return {
      sequence: adIndex + 1,
      title: clean(ad.title, 180),
      angle: clean(ad.angle, 240),
      hook: clean(ad.hook, 500),
      script: clean(ad.script, 12000),
      cta: clean(ad.cta, 500),
      caption: clean(ad.caption || ad.script, 10000),
      actor: actorSnapshot(avatar),
      targetDuration,
      skillDecisions: ad.skillDecisions && typeof ad.skillDecisions === 'object' ? ad.skillDecisions : {},
      scenes
    };
  });

  const routeEntries = ads.flatMap(ad => ad.scenes.map(scene => ({
    adSequence: ad.sequence,
    sceneSequence: scene.sequence,
    kind: scene.kind,
    routerVersion: scene.route.routerVersion || router.ROUTER_VERSION,
    routerMode: scene.route.mode || router.routerMode(),
    routeKey: scene.route.routeKey,
    adapterKey: scene.route.adapterKey || null,
    provider: scene.route.provider,
    videoModel: scene.route.model || scene.route.videoModel || null,
    narratorModel: registry.modelIds().tts,
    lipSyncModel: scene.route.nativeLipSync ? null : (scene.route.audioStrategy === 'TTS_THEN_LIP_SYNC' ? registry.modelIds().lipSync : null),
    reason: scene.route.reason || null,
    referenceRole: scene.route.referenceRole || null,
    audioStrategy: scene.route.audioStrategy,
    nativeLipSync: Boolean(scene.route.nativeLipSync),
    resolution: scene.route.resolution,
    aspectRatio: scene.route.aspectRatio,
    providerDuration: scene.route.providerDuration,
    playbackDuration: scene.route.playbackDuration,
    fallbacks: Array.isArray(scene.route.fallbacks) ? scene.route.fallbacks : []
  })));

  const project = {
    engineVersion: registry.ENGINE_VERSION,
    contractVersion: registry.CONTRACT_VERSION,
    campaignId,
    userId,
    status: 'PLANNED',
    brief: {
      sourceType: clean(input.sourceType || (productAssetIds.length ? 'PRODUCT' : input.productUrl ? 'WEBSITE' : 'BRIEF'), 30).toUpperCase(),
      requestedCampaignType: clean(input.campaignType || 'AUTO', 40).toUpperCase(),
      resolvedCampaignType: clean(resolvedType, 40).toUpperCase(),
      brandProfileId: brand?.id || input.brandProfileId || null,
      brandName: clean(brand?.name, 180),
      productName: clean(brand?.productName, 220),
      productUrl: clean(brand?.websiteUrl || input.productUrl, 2000),
      productDescription: clean(input.productDescription || brand?.summary, 4000),
      notes: clean(input.notes, 1200),
      productAssetIds: [...productAssetIds],
      targetDuration,
      variationCount: Number(input.adCount),
      quality: clean(input.quality || 'STANDARD', 30).toUpperCase()
    },
    actor: {
      version: creators.CREATOR_PROFILE_VERSION,
      mode: clean(input.creatorMode || 'AUTO', 30).toUpperCase(),
      selectedAvatarId: input.avatarId || null,
      assignedActors: ads.map(ad => ({ adSequence: ad.sequence, actor: ad.actor }))
    },
    skills: {
      version: clean(plan.skillsVersion || 'ugc-skills-legacy', 80),
      decisions: plan.skillDecisions && typeof plan.skillDecisions === 'object' ? plan.skillDecisions : {},
      preflight: {
        status: ads.some(ad => ad.skillDecisions?.preflight?.status === 'FAIL') ? 'FAIL' : 'PASS',
        ads: ads.map(ad => ({
          adSequence: ad.sequence,
          status: ad.skillDecisions?.preflight?.status || 'NOT_RUN',
          failedChecks: Array.isArray(ad.skillDecisions?.preflight?.failedChecks) ? ad.skillDecisions.preflight.failedChecks : []
        }))
      }
    },
    productionPlan: {
      title: clean(plan.title, 180),
      campaignType: clean(resolvedType, 40).toUpperCase(),
      skillsVersion: clean(plan.skillsVersion || 'ugc-skills-legacy', 80),
      targetDuration,
      variationCount: Number(input.adCount),
      ads
    },
    router: {
      version: clean(plan.routerVersion || router.ROUTER_VERSION, 80),
      mode: clean(plan.routerMode || router.routerMode(), 40),
      summary: plan.routingSummary && typeof plan.routingSummary === 'object' ? plan.routingSummary : {},
      snapshot: router.routerSnapshot()
    },
    routeDecision: {
      policy: 'CAPABILITY_ROUTER_V1',
      routerVersion: clean(plan.routerVersion || router.ROUTER_VERSION, 80),
      routerMode: clean(plan.routerMode || router.routerMode(), 40),
      registry: registry.registrySnapshot(),
      scenes: routeEntries
    },
    pricing: {
      currency: 'AI_CREDITS',
      retailCreditsPerAd: Number(perAdCredits),
      retailCreditsTotal: Number(totalCredits),
      variationCount: Number(input.adCount),
      targetDuration,
      quality: clean(input.quality || 'STANDARD', 30).toUpperCase(),
      pricingPolicy: 'UGC_FIXED_V1'
    },
    renderJobs: ads.map(ad => ({
      adSequence: ad.sequence,
      adId: null,
      generationId: null,
      status: 'PLANNED',
      phases: ['RESERVE_CREDITS', 'TTS', 'VIDEO', 'LIP_SYNC_OR_MUX', 'ASSEMBLY', 'MEDIA_LIBRARY']
    })),
    qc: {
      status: 'NOT_RUN',
      requiredChecks: [...QC_CHECKS],
      results: []
    }
  };

  project.fingerprint = fingerprint({
    engineVersion: project.engineVersion,
    contractVersion: project.contractVersion,
    brief: project.brief,
    actor: project.actor,
    skills: project.skills,
    productionPlan: project.productionPlan,
    router: project.router,
    routeDecision: project.routeDecision,
    pricing: project.pricing
  });

  validateEngineProject(project);
  return project;
}

function validateEngineProject(project) {
  const errors = [];
  if (!project || typeof project !== 'object') errors.push('project_missing');
  if (project?.engineVersion !== registry.ENGINE_VERSION) errors.push('engine_version');
  if (project?.contractVersion !== registry.CONTRACT_VERSION) errors.push('contract_version');
  if (!project?.campaignId) errors.push('campaign_id');
  if (!project?.userId) errors.push('user_id');
  if (project?.skills?.preflight?.status === 'FAIL') errors.push('skills_preflight');
  if (!project?.router?.version) errors.push('router_version');

  const targetDuration = Number(project?.productionPlan?.targetDuration || 0);
  const ads = project?.productionPlan?.ads;
  if (!Array.isArray(ads) || !ads.length) errors.push('ads_missing');
  if (Array.isArray(ads)) {
    ads.forEach((ad, adIndex) => {
      if (Number(ad.sequence) !== adIndex + 1) errors.push('ad_sequence_' + (adIndex + 1));
      if (!Array.isArray(ad.scenes) || !ad.scenes.length) {
        errors.push('scenes_missing_' + (adIndex + 1));
        return;
      }
      const playback = ad.scenes.reduce((sum, scene) => sum + Number(scene.playbackDuration || 0), 0);
      if (Math.abs(playback - targetDuration) > 0.001) errors.push('playback_duration_' + (adIndex + 1));
      ad.scenes.forEach((scene, sceneIndex) => {
        if (Number(scene.sequence) !== sceneIndex + 1) errors.push('scene_sequence_' + (adIndex + 1) + '_' + (sceneIndex + 1));
        if (!(Number(scene.providerDuration) > 0)) errors.push('provider_duration_' + (adIndex + 1) + '_' + (sceneIndex + 1));
        if (Number(scene.playbackDuration) > Number(scene.providerDuration)) errors.push('playback_exceeds_provider_' + (adIndex + 1) + '_' + (sceneIndex + 1));
        if (!scene.route?.routeKey || !(scene.route?.model || scene.route?.videoModel)) errors.push('route_missing_' + (adIndex + 1) + '_' + (sceneIndex + 1));
      });
    });
  }

  const expectedTotal = Number(project?.pricing?.retailCreditsPerAd || 0) * Number(project?.pricing?.variationCount || 0);
  if (expectedTotal !== Number(project?.pricing?.retailCreditsTotal || 0)) errors.push('pricing_total');

  if (errors.length) {
    const error = new Error('Invalid UGC engine project: ' + errors.join(', '));
    error.code = 'UGC_ENGINE_CONTRACT_INVALID';
    error.validationErrors = errors;
    throw error;
  }
  return true;
}

module.exports = {
  QC_CHECKS,
  playbackDurations,
  actorSnapshot,
  buildEngineProject,
  validateEngineProject,
  fingerprint
};
