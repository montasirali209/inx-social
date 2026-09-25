import type { MediaAsset } from './media-library'

export type UGCQuality = 'STANDARD' | 'PREMIUM'
export type UGCDuration = 20 | 30 | 45 | 60
export type UGCAdCount = 1 | 5 | 10 | 15 | 20
export type UGCCampaignType = 'AUTO' | 'AVATAR_EXPLAINER' | 'PRODUCT_SHOWCASE'
export type UGCCreativeFormat = 'AUTO' | 'PROBLEM_SOLUTION' | 'PRODUCT_DEMO' | 'TESTIMONIAL' | 'UNBOXING' | 'REACTION' | 'BEFORE_AFTER' | 'STORYTIME' | 'SPOKESPERSON' | 'PRODUCT_FOCUSED'
export type UGCCreativeFormatOption = {
  key: UGCCreativeFormat
  label: string
  description: string
  campaignTypes: Array<Exclude<UGCCampaignType, 'AUTO'>>
  bestFor: string[]
  requiresProductReference: boolean
  requiresVerifiedTransformation: boolean
}
export type UGCSourceType = 'WEBSITE' | 'PRODUCT' | 'BRIEF'

export type UGCAvatar = {
  id: string
  scope: 'SYSTEM' | 'USER'
  name: string
  category: string
  presentation: string
  ageBand: string
  locale: string
  voice: string
  voicePrompt: string
  environment: string
  creatorVersion: string
  accent: string
  languages: string[]
  niches: string[]
  environments: string[]
  wardrobe: string[]
  gestures: string[]
  energy: string[]
  featured: boolean
  referenceVersion: number
  referenceReady: boolean
  references: {
    master: { ready: boolean; version: number; qualityStatus: string; qualityScore: number }
    alternateCount: number
    policy: string
  }
  imageUrl: string | null
  createdAt?: string
}

export type UGCAvatarReference = {
  id: string
  avatarId: string
  role: string
  label: string
  source: string
  qualityStatus: string
  qualityScore: number
  imageUrl: string
  createdAt: string
}

export type UGCProductAsset = {
  id: string
  brandProfileId: string | null
  originalName: string
  mimeType: string
  status: string
  imageUrl: string
  createdAt: string
}

export type UGCSampleVideo = {
  id: string
  title: string
  description: string
  campaignType: Exclude<UGCCampaignType, 'AUTO'>
  quality: UGCQuality
  duration: number
  thumbnailUrl: string | null
  videoUrl: string
}

export type UGCBrandProfile = {
  id: string
  name: string
  websiteUrl: string
  productName: string
  summary: string
  audience: string[]
  verifiedClaims: string[]
  brandReferences: Array<string | { url?: string; type?: string; kind?: string }>
  analysis: {
    offerType?: string
    ugcDirections?: string[]
    productInteractionUseful?: boolean
    sourceTitle?: string
    sourceDescription?: string
  }
  updatedAt: string
}

export type UGCScene = {
  id: string
  sequence: number
  status: string
  kind: 'CREATOR' | 'PRODUCT' | 'LIFESTYLE' | 'CTA'
  route: string
  duration: number
  prompt: string
  script: string
  avatarId: string | null
  providerCostUsd: number
  model: string | null
  error: string | null
}

export type UGCAd = {
  id: string
  campaignId: string
  sequence: number
  status: string
  title: string
  angle: string
  hook: string
  script: string
  cta: string
  caption: string
  avatarId: string | null
  avatar: UGCAvatar | null
  route: string
  voice: string
  voicePrompt: string
  duration: number
  quality: UGCQuality
  credits: number
  generationId: string | null
  generationStatus: string
  progress: number
  stage: string
  stageLabel: string
  stageDetail: string
  readyScenes: number
  sceneCount: number
  progressUpdatedAt: string | null
  mediaAssetId: string | null
  musicMode: 'AUTO' | 'NONE'
  captionsEnabled: boolean
  plan: Record<string, unknown>
  error: string | null
  qualityControl: {
    version: string
    status: 'READY' | 'PROCESSING' | 'ASSEMBLY_REQUIRED' | 'RECOVERY_REQUIRED' | 'BLOCKED'
    publishable: boolean
    editable: boolean
    allScenesReady: boolean
    readySceneCount: number
    sceneCount: number
    checks: Array<{ id: string; status: 'PASS' | 'FAIL' | 'PENDING'; detail?: Record<string, unknown> }>
    recovery: {
      action: 'WAIT' | 'RETRY_SCENES' | 'REASSEMBLE' | 'NONE' | 'BLOCKED'
      label: string
      sceneIds: string[]
      scenes: Array<{ id: string; sequence: number; status: string; credits: number }>
      reassemblyCredits: number
    }
  }
  scenes: UGCScene[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type UGCCampaign = {
  id: string
  title: string
  brandProfileId: string | null
  productUrl: string
  productDescription: string
  duration: number
  adCount: number
  quality: UGCQuality
  campaignType: UGCCampaignType
  resolvedType: Exclude<UGCCampaignType, 'AUTO'>
  creativeFormat: UGCCreativeFormat
  resolvedCreativeFormats: Exclude<UGCCreativeFormat, 'AUTO'>[]
  sourceType: UGCSourceType
  productAssetIds: string[]
  creatorMode: 'AUTO' | 'SELECTED' | 'NONE'
  selectedAvatarId: string | null
  status: string
  totalCredits: number
  notes: string
  plan: Record<string, unknown>
  ads: UGCAd[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type UGCOverview = {
  avatars: UGCAvatar[]
  featuredAvatars: UGCAvatar[]
  brands: UGCBrandProfile[]
  campaigns: UGCCampaign[]
  samples: UGCSampleVideo[]
  music: Array<{ id: string; name: string; category: string; durationSeconds: number | null }>
  stats: { ready: number; rendering: number; failed: number }
  credits: { remaining: number; monthlyRemaining: number; topupRemaining: number }
  options: {
    durations: UGCDuration[]
    adCounts: UGCAdCount[]
    qualities: UGCQuality[]
    campaignTypes: UGCCampaignType[]
    creativeFormatVersion: string
    creativeFormats: UGCCreativeFormatOption[]
    studioControlsVersion: string
    renderQualityVersion: string
    renderQuality: {
      version: string
      stages: string[]
      recoveryActions: string[]
      policies: {
        failedSceneIsolated: boolean
        completedScenesReused: boolean
        reassemblyUsesExistingScenes: boolean
        reassemblyCredits: number
        publishRequiresReadyAsset: boolean
      }
    }
    studioControls: {
      version: string
      durations: Array<{ seconds: UGCDuration; label: string; description: string }>
      variationCounts: Array<{ count: UGCAdCount; label: string; description: string }>
      qualityTiers: Array<{
        key: UGCQuality
        label: string
        badge: string
        description: string
        bestFor: string[]
        experience: string[]
      }>
      pricing: {
        policy: string
        matrix: Record<UGCQuality, Record<string, number>>
        formatAffectsPrice: boolean
        creatorSelectionAffectsPrice: boolean
      }
      rules: {
        modelNamesVisibleToCustomer: boolean
        quoteBeforeGeneration: boolean
        explicitCreditConfirmation: boolean
        generationRunsInBackground: boolean
      }
    }
    creatorProfileVersion: string
    systemAvatarCount: number
    featuredAvatarCount: number
  }
}

export type CreateUGCCampaignInput = {
  brandProfileId?: string | null
  productUrl?: string
  productDescription?: string
  productAssetIds?: string[]
  sourceType?: UGCSourceType
  campaignType?: UGCCampaignType
  creativeFormat?: UGCCreativeFormat
  avatarId?: string | null
  creatorMode: 'AUTO' | 'SELECTED' | 'NONE'
  duration: UGCDuration
  adCount: UGCAdCount
  quality: UGCQuality
  notes?: string
}

export type UGCGeneratedReference = {
  kind: 'AVATAR' | 'PRODUCT'
  id: string
  name: string
  imageUrl: string
  prompt: string
  avatarId?: string | null
  productAssetId?: string | null
}

export type UGCWizardDraftSeed = Partial<CreateUGCCampaignInput> & {
  draftId?: string
  wizardStep?: number
  referencePrompt?: string
  generatedReferences?: UGCGeneratedReference[]
  selectedGeneratedProductIds?: string[]
  baseProductAssetIds?: string[]
}

export type UGCAgentMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type UGCAgentReference = {
  url: string
  kind: string
  label: string
}

export type UGCAgentResponse = {
  version: string
  reply: string
  readyToGenerate: boolean
  needsMoreContext: boolean
  quickReplies: string[]
  plan: CreateUGCCampaignInput
  brand: UGCBrandProfile | null
  foundReferences: UGCAgentReference[]
  selectedCreator: UGCAvatar | null
  referenceQuestionAsked: boolean
  estimate: UGCEstimate | null
}

export type UGCEstimate = {
  version: string
  credits: number
  perAd: number
  adCount: number
  duration: number
  quality: UGCQuality
  campaignType: UGCCampaignType
  creativeFormat: UGCCreativeFormat
  tier: {
    key: UGCQuality
    label: string
    badge: string
    description: string
    bestFor: string[]
    experience: string[]
  }
  durationOption: { seconds: number; label: string; description: string }
  variationOption: { count: number; label: string; description: string }
  affordability: {
    affordable: boolean
    balanceBefore: number
    balanceAfter: number
    shortfall: number
    alternative: null | {
      quality: UGCQuality
      duration: UGCDuration
      adCount: UGCAdCount
      perAd: number
      credits: number
      label: string
    }
  }
  pricing: {
    policy: string
    formatAffectsPrice: boolean
    creatorSelectionAffectsPrice: boolean
    matrix: Record<UGCQuality, Record<string, number>>
  }
  production: {
    providerNamesHidden: boolean
    routerManaged: boolean
    output: string
    resolution: string
    backgroundRendering: boolean
    recoverableJobs: boolean
  }
}

export type UGCEditorUpdate = {
  avatarId?: string | null
  script?: string
  voice?: string
  voicePrompt?: string
  musicMode?: 'AUTO' | 'NONE'
  captionsEnabled?: boolean
  cta?: string
  caption?: string
}

export type UGCSchedulerState = {
  mediaLibraryAssets: MediaAsset[]
  aiMixedCampaign: {
    id: string
    title: string
    posts: Array<{ id: string; contentType: 'VIDEO'; caption: string; mediaAssetId: string }>
  }
}
