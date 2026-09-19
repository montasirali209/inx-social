export const site = {
  name: 'INXSocial',
  company: 'INAXX LTD',
  description: 'Plan, create, schedule and analyse social content from one intelligent workspace.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.inxsocial.co.uk',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://social.inaxx.co.uk/app',
  registerUrl: process.env.NEXT_PUBLIC_REGISTER_URL || 'https://social.inaxx.co.uk/portal/register.html',
  supportEmail: 'support@inxsocial.co.uk',
} as const

export const primaryNav = [
  { label: 'Product', href: '/#product' },
  { label: 'AI Studio', href: '/#ai-studio' },
  { label: 'Platforms', href: '/#platforms' },
  { label: 'Pricing', href: '/pricing' },
] as const
