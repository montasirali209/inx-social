import type { Plan, PlanFeature, PlanId } from '../types/billing'

const captionFeatures: PlanFeature[] = ['ai_caption_enhancement', 'ai_caption_writing', 'ai_caption_suggestions']
const aiStudioFeatures: PlanFeature[] = ['ai_content_studio', 'ai_image_generation', 'ai_video_generation']

export const plans: Plan[] = [
  {
    id: 'trial', name: 'Trial', eyebrow: '7 days · try the full workflow', connectedPagesLimit: 2, schedulingWindowDays: null, publishedPostsLimit: 50, monthlyAiCredits: 20,
    features: ['analytics', ...captionFeatures, ...aiStudioFeatures, 'bulk_scheduler'],
    highlights: ['Up to 2 connected accounts', '50 published posts during the trial', 'Unlimited drafting, scheduling and Bulk Scheduler', 'Full Analytics and all AI caption assistance', 'Full AI Content Studio · 20 credits', 'Standard support'],
  },
  {
    id: 'creator', name: 'Creator', eyebrow: 'For individual creators', monthlyPrice: 18.99, connectedPagesLimit: 5, schedulingWindowDays: null, publishedPostsLimit: null, monthlyAiCredits: 150,
    features: ['unlimited_posts', 'analytics', ...captionFeatures, ...aiStudioFeatures, 'bulk_scheduler'],
    highlights: ['Up to 5 connected accounts', 'Unlimited posts and scheduling', 'Bulk Scheduler and full Analytics', 'All AI caption assistance', 'Full AI Content Studio · 150 credits/month', 'Standard support'],
  },
  {
    id: 'pro', name: 'Pro', eyebrow: 'Most popular', monthlyPrice: 34.99, connectedPagesLimit: 12, schedulingWindowDays: null, publishedPostsLimit: null, monthlyAiCredits: 500, recommended: true,
    features: ['unlimited_posts', 'analytics', ...captionFeatures, ...aiStudioFeatures, 'bulk_scheduler', 'priority_support'],
    highlights: ['Up to 12 connected accounts', 'Unlimited posts and scheduling', 'Bulk Scheduler and full Analytics', 'All AI caption assistance', 'Full AI Content Studio · 500 credits/month', 'Priority support'],
  },
  {
    id: 'business', name: 'Business', eyebrow: 'For brands and teams', monthlyPrice: 59.99, connectedPagesLimit: 25, schedulingWindowDays: null, publishedPostsLimit: null, monthlyAiCredits: 1200,
    features: ['unlimited_posts', 'analytics', ...captionFeatures, ...aiStudioFeatures, 'bulk_scheduler', 'priority_support'],
    highlights: ['Up to 25 connected accounts', 'Unlimited posts and scheduling', 'Bulk Scheduler and full Analytics', 'All AI caption assistance', 'Full AI Content Studio · 1,200 credits/month', 'Priority support'],
  },
  {
    id: 'agency', name: 'Agency', eyebrow: 'For high-volume workspaces', monthlyPrice: 99.99, connectedPagesLimit: 50, schedulingWindowDays: null, publishedPostsLimit: null, monthlyAiCredits: 2500,
    features: ['unlimited_posts', 'analytics', ...captionFeatures, ...aiStudioFeatures, 'bulk_scheduler', 'priority_support', 'priority_plus_support'],
    highlights: ['Up to 50 connected accounts', 'Unlimited posts and scheduling', 'Bulk Scheduler and full Analytics', 'All AI caption assistance', 'Full AI Content Studio · 2,500 credits/month', 'Priority+ support'],
  },
]

export const comparisonRows: Array<{ label: string; values: Record<PlanId, string | boolean> }> = [
  { label: 'Connected Accounts', values: { trial: '2', creator: '5', pro: '12', business: '25', agency: '50' } },
  { label: 'Published Posts', values: { trial: '50 during trial', creator: 'Unlimited', pro: 'Unlimited', business: 'Unlimited', agency: 'Unlimited' } },
  { label: 'Scheduling & Bulk Scheduler', values: { trial: true, creator: true, pro: true, business: true, agency: true } },
  { label: 'Full Analytics', values: { trial: true, creator: true, pro: true, business: true, agency: true } },
  { label: 'AI Caption Assistance', values: { trial: true, creator: true, pro: true, business: true, agency: true } },
  { label: 'Full AI Content Studio', values: { trial: true, creator: true, pro: true, business: true, agency: true } },
  { label: 'AI Credits', values: { trial: '20 once', creator: '150 / month', pro: '500 / month', business: '1,200 / month', agency: '2,500 / month' } },
  { label: 'AI Image Generation', values: { trial: true, creator: true, pro: true, business: true, agency: true } },
  { label: 'AI Video Generation', values: { trial: true, creator: true, pro: true, business: true, agency: true } },
  { label: 'Stock Video Creator', values: { trial: 'Uses AI credits', creator: 'Uses AI credits', pro: 'Uses AI credits', business: 'Uses AI credits', agency: 'Uses AI credits' } },
  { label: 'Support', values: { trial: 'Standard', creator: 'Standard', pro: 'Priority', business: 'Priority', agency: 'Priority+' } },
]

export const billingHelp = [
  ['How does the Trial work?', 'The seven-day Trial gives you the real INXSocial workflow: two connected accounts, up to 50 published posts, scheduling and Bulk Scheduler, Full Analytics, all AI caption assistance and full AI Content Studio access with 20 one-time AI credits.'],
  ['How do I upgrade from Trial?', 'Choose Creator, Pro, Business or Agency below and continue to Stripe Checkout. Your access refreshes after Stripe confirms payment.'],
  ['Which plan is recommended?', 'Pro is the recommended plan for serious creators and small businesses: 12 connected accounts, all publishing and analytics features, priority support and 500 AI credits each billing period.'],
  ['How do AI Studio credits work?', 'AI credits are shared across image, carousel, AI video, UGC and Stock Video Creator workflows. Expensive video models consume more credits than economical models. Monthly credits refresh each billing period; purchased top-up credits remain separate and are used after monthly credits.'],
  ['Can I buy extra AI credits?', 'Paid plans can buy one-time AI credit packs from Billing & Plans. Purchased credits are added to the separate top-up balance and are not replaced by the next monthly allowance.'],
  ['How do I update my payment method?', 'Use Update Payment Method. INXSocial opens Stripe Customer Portal; payment information never appears inside INXSocial.'],
  ['How do I download invoices?', 'Open an invoice in the invoice list and use Stripe’s hosted view or PDF download.'],
  ['How do I cancel?', 'Open Manage Subscription and continue to Stripe. Stripe shows the effective cancellation date before confirmation.'],
  ['What happens when Trial expires?', 'Publishing, scheduling, analytics and AI generation are paused until you choose a paid plan. Existing content and Media Library records remain in your account.'],
  ['How do plan limits work?', 'Connected-account and Trial publishing limits are enforced by the backend. AI generation is protected by the credit wallet and the credit estimate shown before generation.'],
] as const

export function getPlan(id: PlanId) { return plans.find((plan) => plan.id === id) ?? plans[0] }
