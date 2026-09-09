import type { Plan, PlanFeature, PlanId } from '../types/billing'

const captionFeatures: PlanFeature[] = ['ai_caption_enhancement', 'ai_caption_writing', 'ai_caption_suggestions']

export const plans: Plan[] = [
  {
    id: 'trial', name: 'Trial', eyebrow: 'Start publishing', connectedPagesLimit: 2, schedulingWindowDays: 30,
    features: ['unlimited_posts', 'priority_support'],
    highlights: ['Up to 2 connected pages', 'Unlimited posts, photos and videos', 'Schedule up to 30 days in one workflow', 'Priority support'],
  },
  {
    id: 'pro', name: 'Pro', eyebrow: 'Main paid plan', monthlyPrice: 9.99, connectedPagesLimit: null, schedulingWindowDays: null,
    features: ['unlimited_posts', 'unlimited_pages', 'analytics', ...captionFeatures, 'priority_support'],
    highlights: ['Unlimited connected pages', 'Unlimited posts and videos', 'Full Analytics', 'All AI caption assistance', 'Priority support'],
  },
  {
    id: 'plus', name: 'Plus', eyebrow: 'Most advanced plan', monthlyPrice: 15.99, connectedPagesLimit: null, schedulingWindowDays: null,
    features: ['unlimited_posts', 'unlimited_pages', 'analytics', ...captionFeatures, 'ai_content_studio', 'ai_image_generation', 'ai_video_generation', 'priority_support'],
    highlights: ['Everything in Pro', 'Full AI Content Studio', 'AI image generation', 'AI video generation', 'Advanced and future AI creative tools'],
  },
]

export const comparisonRows: Array<{ label: string; values: Record<PlanId, string | boolean> }> = [
  { label: 'Connected Pages', values: { trial: '2', pro: 'Unlimited', plus: 'Unlimited' } },
  { label: 'Posting', values: { trial: 'Unlimited', pro: 'Unlimited', plus: 'Unlimited' } },
  { label: 'Scheduling Window', values: { trial: 'Up to 30 days', pro: 'Unlimited', plus: 'Unlimited' } },
  { label: 'Analytics', values: { trial: false, pro: 'Full', plus: 'Full' } },
  { label: 'AI Caption Enhancement', values: { trial: false, pro: true, plus: true } },
  { label: 'AI Caption Writing', values: { trial: false, pro: true, plus: true } },
  { label: 'AI Caption Suggestions', values: { trial: false, pro: true, plus: true } },
  { label: 'AI Content Studio', values: { trial: false, pro: false, plus: true } },
  { label: 'AI Image Generation', values: { trial: false, pro: false, plus: true } },
  { label: 'AI Video Generation', values: { trial: false, pro: false, plus: true } },
  { label: 'Priority Support', values: { trial: true, pro: true, plus: true } },
]

export const billingHelp = [
  ['How does the Trial work?', 'Trial includes two connected pages, unlimited publishing, a 30-day scheduling window per workflow and priority support. Analytics and AI tools stay locked.'],
  ['How do I upgrade from Trial?', 'Choose Pro or Plus below, review the price and continue to Stripe Checkout. Your access refreshes after Stripe confirms payment.'],
  ['What is the difference between Pro and Plus?', 'Pro includes Analytics and AI caption assistance. Plus adds the full AI Content Studio, including image, video and advanced creative generation.'],
  ['How do I update my payment method?', 'Use Update Payment Method. INXSocial opens Stripe Customer Portal; payment information never appears inside INXSocial.'],
  ['How do I download invoices?', 'Open an invoice in the invoice list and use Stripe’s hosted view or PDF download.'],
  ['How do I cancel?', 'Open Manage Subscription and continue to Stripe. Stripe shows the effective cancellation date before confirmation.'],
  ['What happens when Trial expires?', 'Publishing and scheduling are paused until you choose a paid plan. Existing content records remain in your account.'],
  ['How do plan limits work?', 'Only true numeric limits use counters. Unlimited and locked features are labelled explicitly throughout this page.'],
] as const

export function getPlan(id: PlanId) { return plans.find((plan) => plan.id === id) ?? plans[0] }
