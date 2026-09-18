export type PlanId = 'trial' | 'creator' | 'pro' | 'business' | 'agency'
export type BillingCycle = 'monthly' | 'yearly' | 'trial'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'grace_period' | 'cancelled' | 'paused' | 'expired' | 'manual'
export type PlanFeature =
  | 'unlimited_posts' | 'analytics' | 'ai_caption_enhancement'
  | 'ai_caption_writing' | 'ai_caption_suggestions' | 'ai_content_studio'
  | 'ai_image_generation' | 'ai_video_generation' | 'priority_support'
  | 'priority_plus_support' | 'bulk_scheduler'

export type Plan = {
  id: PlanId
  name: string
  eyebrow: string
  monthlyPrice?: number
  yearlyPrice?: number
  connectedPagesLimit: number | null
  schedulingWindowDays: number | null
  publishedPostsLimit?: number | null
  monthlyAiCredits: number
  recommended?: boolean
  features: PlanFeature[]
  highlights: string[]
}

export type Subscription = {
  planId: PlanId
  sourcePlan: string
  status: SubscriptionStatus
  billingCycle: BillingCycle
  trialEndsAt?: string | null
  renewalDate?: string | null
  cancelAtPeriodEnd: boolean
  canManage: boolean
  legacyLifetime?: boolean
  administrator?: boolean
  manualOverride?: boolean
  overrideExpiresAt?: string | null
}

export type InvoiceStatus = 'paid' | 'upcoming' | 'failed' | 'refunded'
export type Invoice = { id: string; date: string; amount: number; currency: string; status: InvoiceStatus; invoiceUrl?: string | null; pdfUrl?: string | null }

export type BillingOverview = {
  subscription: Subscription
  usage: { connectedPages: number; scheduledContent: number; publishedPosts?: number; periodStart: string; periodEnd?: string | null }
  preferences: { productUpdates: boolean; usageLimitAlerts: boolean }
  billing: {
    configured: boolean
    availability: Record<'creator' | 'pro' | 'business' | 'agency', Record<'monthly' | 'yearly', boolean>>
  }
  invoices: Invoice[]
}
