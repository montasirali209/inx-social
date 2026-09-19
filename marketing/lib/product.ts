export type MarketingPlan = {
  id: 'trial' | 'creator' | 'pro' | 'business' | 'agency'
  name: string
  eyebrow: string
  price: number
  accounts: number
  credits: number
  posts: string
  support: string
  featured?: boolean
}

export const plans: MarketingPlan[] = [
  { id: 'trial', name: 'Trial', eyebrow: '7 days', price: 0, accounts: 2, credits: 20, posts: '50 published posts', support: 'Standard support' },
  { id: 'creator', name: 'Creator', eyebrow: 'For individual creators', price: 18.99, accounts: 5, credits: 150, posts: 'Unlimited posts', support: 'Standard support' },
  { id: 'pro', name: 'Pro', eyebrow: 'Most popular', price: 34.99, accounts: 12, credits: 500, posts: 'Unlimited posts', support: 'Priority support', featured: true },
  { id: 'business', name: 'Business', eyebrow: 'For brands & teams', price: 59.99, accounts: 25, credits: 1200, posts: 'Unlimited posts', support: 'Priority support' },
  { id: 'agency', name: 'Agency', eyebrow: 'High-volume workspaces', price: 99.99, accounts: 50, credits: 2500, posts: 'Unlimited posts', support: 'Priority+ support' },
]

export const platforms = [
  { name: 'Facebook', mark: 'f', tone: '#1877f2' },
  { name: 'Instagram', mark: '◎', tone: '#e1306c' },
  { name: 'LinkedIn', mark: 'in', tone: '#0a66c2' },
  { name: 'TikTok', mark: '♪', tone: '#25f4ee' },
  { name: 'YouTube', mark: '▶', tone: '#ff0033' },
  { name: 'Pinterest', mark: 'p', tone: '#e60023' },
  { name: 'Threads', mark: '@', tone: '#f6f7f8' },
  { name: 'Bluesky', mark: '∿', tone: '#1685ff' },
  { name: 'X', mark: 'X', tone: '#f8fafc' },
] as const

export const faqs = [
  ['Which social platforms are supported?', 'INXSocial supports Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and X. Available publishing and analytics capabilities can vary by network permissions and account type.'],
  ['Can I bulk schedule content?', 'Yes. Bulk Scheduler lets you prepare multiple media items, captions, destinations and timing rules in one workflow, then build the schedule without creating every post one by one.'],
  ['How does the 7-day Trial work?', 'The Trial includes up to 2 connected accounts, up to 50 published posts, scheduling and Bulk Scheduler, Full Analytics, AI caption assistance and 20 one-time AI Content Studio credits. No card is required to start.'],
  ['How do AI credits work?', 'AI credits are shared across Image Post, Carousel, AI Video, UGC and Stock Video Creator workflows. More expensive generation models consume more credits than economical models.'],
  ['Can I buy extra AI credits?', 'Paid plans can purchase one-time credit packs from Billing & Plans. Top-up credits are kept separately from the monthly plan allowance and remain available until used.'],
  ['Is AI Content Studio separate from publishing?', 'No. AI Content Studio creates media and publishing copy inside INXSocial, then sends the finished result into Posts so it can be scheduled to connected destinations.'],
] as const
