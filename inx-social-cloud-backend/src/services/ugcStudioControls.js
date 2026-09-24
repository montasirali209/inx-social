const STUDIO_CONTROLS_VERSION = 'ugc-studio-controls-v1';

const SUPPORTED_DURATIONS = Object.freeze([15, 20, 30]);
const SUPPORTED_COUNTS = Object.freeze([1, 5, 10, 15, 20]);
const SUPPORTED_QUALITIES = Object.freeze(['STANDARD', 'PREMIUM']);

const QUALITY_TIERS = Object.freeze({
  STANDARD: Object.freeze({
    key: 'STANDARD',
    label: 'Standard',
    badge: 'Efficient',
    description: 'Natural social UGC for everyday creator-led and product-led campaigns.',
    bestFor: ['Testing hooks and formats', 'Organic-style ads', 'Efficient multi-variation campaigns'],
    experience: [
      'Natural vertical social-video output',
      'Creator and product continuity safeguards',
      'Structured scene planning and captions',
      'Background rendering with recovery'
    ]
  }),
  PREMIUM: Object.freeze({
    key: 'PREMIUM',
    label: 'Premium',
    badge: 'Advanced',
    description: 'Higher-control production for expressive creator delivery, complex motion and richer product or lifestyle scenes.',
    bestFor: ['Hero creative', 'Complex movement', 'Premium product and lifestyle scenes'],
    experience: [
      'Advanced scene routing by capability',
      'Stronger creator delivery options when supported',
      'Richer product and lifestyle motion',
      'The same evidence, identity and product-fidelity safeguards'
    ]
  })
});

const DURATION_OPTIONS = Object.freeze({
  15: Object.freeze({ seconds: 15, label: 'Quick', description: 'Fast hook and one clear message.' }),
  20: Object.freeze({ seconds: 20, label: 'Balanced', description: 'More room for proof while keeping a tight social pace.' }),
  30: Object.freeze({ seconds: 30, label: 'Full ad', description: 'Best when the story needs several beats or demonstrations.' })
});

const VARIATION_OPTIONS = Object.freeze({
  1: Object.freeze({ count: 1, label: 'Single', description: 'One finished creative direction.' }),
  5: Object.freeze({ count: 5, label: 'Test pack', description: 'A practical set of hooks and structures to compare.' }),
  10: Object.freeze({ count: 10, label: 'Campaign', description: 'Broader creative coverage for active testing.' }),
  15: Object.freeze({ count: 15, label: 'Scale', description: 'A larger batch for sustained creative rotation.' }),
  20: Object.freeze({ count: 20, label: 'Max batch', description: 'The largest supported batch in one campaign.' })
});

function normalizePricing(pricing = {}) {
  const standard = pricing.STANDARD || pricing.standard || {};
  const premium = pricing.PREMIUM || pricing.premium || {};
  return {
    STANDARD: Object.fromEntries(SUPPORTED_DURATIONS.map(duration => [duration, Number(standard[duration] || 0)])),
    PREMIUM: Object.fromEntries(SUPPORTED_DURATIONS.map(duration => [duration, Number(premium[duration] || 0)]))
  };
}

function assertSelection(input = {}, pricing = {}) {
  const duration = Number(input.duration);
  const adCount = Number(input.adCount);
  const quality = String(input.quality || 'STANDARD').toUpperCase();
  if (!SUPPORTED_DURATIONS.includes(duration)) {
    const error = new Error('Choose a supported UGC duration.');
    error.code = 'UGC_DURATION_UNSUPPORTED';
    throw error;
  }
  if (!SUPPORTED_COUNTS.includes(adCount)) {
    const error = new Error('Choose a supported UGC variation count.');
    error.code = 'UGC_AD_COUNT_UNSUPPORTED';
    throw error;
  }
  if (!SUPPORTED_QUALITIES.includes(quality)) {
    const error = new Error('Choose Standard or Premium UGC quality.');
    error.code = 'UGC_QUALITY_UNSUPPORTED';
    throw error;
  }
  const matrix = normalizePricing(pricing);
  const perAd = Number(matrix[quality][duration] || 0);
  if (!(perAd > 0)) {
    const error = new Error('UGC pricing is unavailable for this selection.');
    error.code = 'UGC_PRICING_UNAVAILABLE';
    throw error;
  }
  return { duration, adCount, quality, perAd, matrix };
}

function closestAffordable({ balanceRemaining, desired, matrix }) {
  const balance = Math.max(0, Number(balanceRemaining || 0));
  const candidates = [];
  for (const quality of SUPPORTED_QUALITIES) {
    for (const duration of SUPPORTED_DURATIONS) {
      for (const adCount of SUPPORTED_COUNTS) {
        const perAd = Number(matrix[quality][duration] || 0);
        const credits = perAd * adCount;
        if (perAd > 0 && credits <= balance) {
          const score =
            (quality === desired.quality ? 100000 : 0) +
            (duration === desired.duration ? 10000 : 0) +
            Math.min(adCount, desired.adCount) * 100 -
            Math.abs(duration - desired.duration) * 10 -
            Math.max(0, adCount - desired.adCount);
          candidates.push({ quality, duration, adCount, perAd, credits, score });
        }
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || b.credits - a.credits);
  const best = candidates[0];
  if (!best) return null;
  return {
    quality: best.quality,
    duration: best.duration,
    adCount: best.adCount,
    perAd: best.perAd,
    credits: best.credits,
    label: best.adCount + ' × ' + best.duration + 's ' + QUALITY_TIERS[best.quality].label
  };
}

function quote({ input, balanceRemaining = 0, pricing = {} }) {
  const selection = assertSelection(input, pricing);
  const credits = selection.perAd * selection.adCount;
  const balance = Math.max(0, Number(balanceRemaining || 0));
  const affordable = balance >= credits;
  const after = Math.max(0, balance - credits);
  const campaignType = String(input.campaignType || 'AUTO').toUpperCase();
  const creativeFormat = String(input.creativeFormat || 'AUTO').toUpperCase();

  return {
    version: STUDIO_CONTROLS_VERSION,
    credits,
    perAd: selection.perAd,
    adCount: selection.adCount,
    duration: selection.duration,
    quality: selection.quality,
    campaignType,
    creativeFormat,
    tier: QUALITY_TIERS[selection.quality],
    durationOption: DURATION_OPTIONS[selection.duration],
    variationOption: VARIATION_OPTIONS[selection.adCount],
    affordability: {
      affordable,
      balanceBefore: balance,
      balanceAfter: affordable ? after : balance,
      shortfall: affordable ? 0 : credits - balance,
      alternative: affordable ? null : closestAffordable({
        balanceRemaining: balance,
        desired: selection,
        matrix: selection.matrix
      })
    },
    pricing: {
      policy: 'UGC_FIXED_V1',
      formatAffectsPrice: false,
      creatorSelectionAffectsPrice: false,
      matrix: selection.matrix
    },
    production: {
      providerNamesHidden: true,
      routerManaged: true,
      output: 'Vertical social video',
      resolution: '720p',
      backgroundRendering: true,
      recoverableJobs: true
    }
  };
}

function snapshot(pricing = {}) {
  const matrix = normalizePricing(pricing);
  return {
    version: STUDIO_CONTROLS_VERSION,
    durations: SUPPORTED_DURATIONS.map(duration => DURATION_OPTIONS[duration]),
    variationCounts: SUPPORTED_COUNTS.map(count => VARIATION_OPTIONS[count]),
    qualityTiers: SUPPORTED_QUALITIES.map(quality => QUALITY_TIERS[quality]),
    pricing: {
      policy: 'UGC_FIXED_V1',
      matrix,
      formatAffectsPrice: false,
      creatorSelectionAffectsPrice: false
    },
    rules: {
      modelNamesVisibleToCustomer: false,
      quoteBeforeGeneration: true,
      explicitCreditConfirmation: true,
      generationRunsInBackground: true
    }
  };
}

module.exports = {
  STUDIO_CONTROLS_VERSION,
  SUPPORTED_DURATIONS,
  SUPPORTED_COUNTS,
  SUPPORTED_QUALITIES,
  QUALITY_TIERS,
  DURATION_OPTIONS,
  VARIATION_OPTIONS,
  normalizePricing,
  assertSelection,
  closestAffordable,
  quote,
  snapshot
};
