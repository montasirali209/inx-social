export type AcquisitionVisual = 'features' | 'ai' | 'bulk' | 'analytics' | 'accounts' | 'scheduler' | 'platform'

export type AcquisitionSection = {
  title: string
  text: string
  points: string[]
}

export type AcquisitionPage = {
  slug: string
  eyebrow: string
  title: string
  description: string
  visual: AcquisitionVisual
  platform?: string
  platformMark?: string
  platformTone?: string
  proof: string[]
  sections: AcquisitionSection[]
  faqs: Array<[string, string]>
  related: Array<{ label: string; href: string }>
}

const commonSchedulerFaqs: Array<[string, string]> = [
  ['Can I schedule to more than one connected destination?', 'Yes. INXSocial lets you choose from the connected destinations available in your workspace. Account and network capabilities depend on each platform connection and permission set.'],
  ['Does scheduling include Bulk Scheduler?', 'Yes. Scheduling and Bulk Scheduler are included in the Trial and every paid plan. Paid plans have unlimited posts; the Trial allows up to 50 published posts during its seven-day period.'],
  ['Can I use AI-created content in scheduled posts?', 'Yes. AI Content Studio can generate media and publishing copy, then move the result into Posts so it can be scheduled to connected destinations.'],
]

export const acquisitionPages: Record<string, AcquisitionPage> = {
  features: {
    slug: 'features',
    eyebrow: 'INXSocial product',
    title: 'One workspace for the full social publishing cycle.',
    description: 'Create posts, organise media, schedule at scale, manage connected accounts, analyse performance and use AI-assisted content workflows without stitching separate tools together.',
    visual: 'features',
    proof: ['Post creation', 'Bulk Scheduler', 'Content Calendar', 'AI Content Studio', 'Full Analytics', 'Connected Accounts'],
    sections: [
      {
        title: 'Build content without breaking the workflow',
        text: 'Create text, media, carousel and video posts from one publishing workspace. Use Media Library and AI Content Studio when you need assets, then continue directly into scheduling.',
        points: ['Text, image, carousel and video post workflows', 'Media Library stays connected to publishing', 'AI caption writing and enhancement', 'Destination selection inside the same workspace'],
      },
      {
        title: 'Plan one post or an entire campaign',
        text: 'Use regular scheduling when you want precision, or Bulk Scheduler when you want to prepare many content items and timing rules together.',
        points: ['Publish now or schedule for later', 'Bulk campaign planning', 'Calendar visibility for scheduled and published content', 'Multi-destination workflow'],
      },
      {
        title: 'Keep measurement beside execution',
        text: 'Full Analytics lives in the same product as creation and scheduling, so measured performance can inform the next content cycle without exporting the workflow elsewhere.',
        points: ['Publishing activity visibility', 'Engagement and performance trends', 'Connected-account context', 'Platform distribution context'],
      },
    ],
    faqs: [
      ['What is included in INXSocial?', 'INXSocial combines post creation, scheduling, Bulk Scheduler, Content Calendar, Media Library, Connected Accounts, Full Analytics, AI caption assistance and AI Content Studio in one product.'],
      ['Which plans include the full workflow?', 'The seven-day Trial includes the core workflow with two connected accounts, up to 50 published posts and 20 AI credits. Creator, Pro, Business and Agency include unlimited posts and higher account and AI-credit allowances.'],
      ['Can generated media be reused?', 'Generated and uploaded media can be kept in Media Library and reused in the publishing workflow, subject to the product retention and account rules shown in the app.'],
    ],
    related: [
      { label: 'Bulk Scheduler', href: '/bulk-scheduler' },
      { label: 'AI Content Studio', href: '/ai-content-studio' },
      { label: 'Full Analytics', href: '/analytics' },
    ],
  },
  'ai-content-studio': {
    slug: 'ai-content-studio',
    eyebrow: 'AI Content Studio',
    title: 'Create social-ready media and copy inside your publishing workflow.',
    description: 'Generate images, carousels, short video, UGC-style creative and stock-video content, then move the result directly into Posts for scheduling.',
    visual: 'ai',
    proof: ['Image Post', 'Carousel Post', 'Short Video / Reel', 'UGC Ad', 'Stock Video Creator', 'Shared AI credits'],
    sections: [
      {
        title: 'One studio, several content formats',
        text: 'Choose the format that matches the job instead of forcing every idea through the same generator. Each workflow is focused on the content type you are trying to publish.',
        points: ['Image Post generation', 'Coordinated carousel creation', 'AI-generated short video', 'Stock Video Creator workflow', 'UGC-style promotional creative'],
      },
      {
        title: 'Credits stay predictable',
        text: 'AI Content Studio uses one shared credit wallet. Image, carousel, video, UGC and stock-video workflows draw from that balance, while more expensive video models consume more credits than economical routes.',
        points: ['Trial includes 20 one-time credits', 'Creator includes 150 credits / month', 'Pro includes 500 credits / month', 'Business includes 1,200 credits / month', 'Agency includes 2,500 credits / month'],
      },
      {
        title: 'Creation ends in publishing, not another download folder',
        text: 'The finished result can move into Posts so captions, destinations and scheduling continue in INXSocial. This keeps AI generation part of the publishing system rather than a disconnected tool.',
        points: ['Send finished creative into Posts', 'Keep assets available in Media Library', 'Use AI caption assistance alongside media generation', 'Continue into Scheduler and Calendar'],
      },
    ],
    faqs: [
      ['What can AI Content Studio generate?', 'Current workflows cover Image Post, Carousel Post, Short Video / Reel, UGC Ad and Stock Video Creator. AI Video Clipping is presented as coming soon.'],
      ['Do all plans include AI Content Studio?', 'Yes. The Trial and every paid plan include AI Content Studio. Plans differ mainly by connected-account capacity, AI-credit allowance and support level.'],
      ['How are video generations charged?', 'The app shows a credit estimate before generation. More expensive video models consume more credits than economical models, and the backend credit wallet enforces the charge.'],
    ],
    related: [
      { label: 'See pricing', href: '/pricing' },
      { label: 'Bulk Scheduler', href: '/bulk-scheduler' },
      { label: 'Product features', href: '/features' },
    ],
  },
  'bulk-scheduler': {
    slug: 'bulk-scheduler',
    eyebrow: 'Bulk Scheduler',
    title: 'Schedule campaigns without creating every post one by one.',
    description: 'Prepare multiple media items, captions, destinations and timing rules in one workflow, then turn the batch into a clear publishing schedule.',
    visual: 'bulk',
    proof: ['Batch content', 'Multiple destinations', 'Planned time slots', 'Calendar visibility', 'Included on every plan'],
    sections: [
      {
        title: 'Bring the campaign into one planning session',
        text: 'Bulk Scheduler is designed for the moment when one-by-one scheduling becomes repetitive. Work through the content batch together instead of repeatedly reopening the composer.',
        points: ['Prepare several media items together', 'Assign captions and destination choices', 'Use planned scheduling slots', 'Review the batch before scheduling'],
      },
      {
        title: 'Keep destination choices explicit',
        text: 'Connected accounts remain part of the scheduling decision. You can organise content around the pages and platforms available in the workspace rather than relying on one global active account.',
        points: ['Select connected destinations for the content', 'Reuse the same connected-account workspace', 'Keep account context visible', 'Continue into Calendar after scheduling'],
      },
      {
        title: 'Built into the same product as creation and analytics',
        text: 'Bulk scheduling is not a separate import utility. It sits beside Posts, Calendar, Media Library, AI Content Studio and Analytics so the campaign remains visible after the schedule is built.',
        points: ['Included with the seven-day Trial', 'Unlimited scheduling on paid plans', 'Works with uploaded and generated media', 'Feeds the same Calendar and publishing status system'],
      },
    ],
    faqs: [
      ['Is Bulk Scheduler included in the Trial?', 'Yes. The seven-day Trial includes scheduling and Bulk Scheduler, with up to 50 published posts during the trial period.'],
      ['Do paid plans limit scheduled posts?', 'Creator, Pro, Business and Agency include unlimited posts and scheduling. Connected-account capacity and AI credits vary by plan.'],
      ['Can AI Content Studio media be bulk scheduled?', 'Generated media can be kept in Media Library and used in publishing workflows, including campaign scheduling where supported by the current composer and scheduler flow.'],
    ],
    related: [
      { label: 'Social media scheduler', href: '/social-media-scheduler' },
      { label: 'Content features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  analytics: {
    slug: 'analytics',
    eyebrow: 'Full Analytics',
    title: 'Understand performance without leaving the publishing workspace.',
    description: 'Review publishing activity, engagement and measured trends across selected connected accounts, then use the insight to improve the next content cycle.',
    visual: 'analytics',
    proof: ['Post performance', 'Engagement trends', 'Platform distribution', 'Connected-account context', 'Included on every plan'],
    sections: [
      {
        title: 'Keep performance tied to the content workflow',
        text: 'Analytics is most useful when it stays connected to the posts, accounts and schedules that produced the result. INXSocial keeps those areas inside the same workspace.',
        points: ['Publishing activity overview', 'Engagement and performance metrics', 'Platform distribution context', 'Connected-account filtering'],
      },
      {
        title: 'Use measured trends, not decorative charts',
        text: 'The analytics workspace is built to show live account data where the connected network makes it available. It does not need invented demo numbers to look useful.',
        points: ['Live provider data where available', 'Account and date-range context', 'Clear unavailable-data states', 'No fake production metrics'],
      },
      {
        title: 'Full Analytics is not reserved for the highest plan',
        text: 'The Trial, Creator, Pro, Business and Agency plans all include Full Analytics. Upgrading increases capacity and AI allowance rather than withholding the measurement workflow.',
        points: ['Trial includes Full Analytics', 'Creator includes Full Analytics', 'Pro includes Full Analytics', 'Business and Agency include Full Analytics'],
      },
    ],
    faqs: [
      ['Which plans include analytics?', 'Full Analytics is included in the Trial and every paid plan.'],
      ['Does every social network expose the same analytics?', 'No. Available metrics depend on the connected network, its API permissions and the account type. INXSocial can only display data the provider makes available to the authorised connection.'],
      ['Can I analyse multiple connected accounts?', 'The analytics workspace is designed around selected connected accounts and platform context, subject to the data available for each connection.'],
    ],
    related: [
      { label: 'Connected Accounts', href: '/connected-accounts' },
      { label: 'Social media scheduler', href: '/social-media-scheduler' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  'connected-accounts': {
    slug: 'connected-accounts',
    eyebrow: 'Connected Accounts',
    title: 'Manage your social destinations once and reuse them everywhere.',
    description: 'Keep pages, profiles and destinations in one account workspace so Posts, Scheduler, Calendar and Analytics can use the same connected context.',
    visual: 'accounts',
    proof: ['9 supported networks', 'Multiple destinations', 'Connection health', 'Reusable account workspace', 'Plan-based limits'],
    sections: [
      {
        title: 'A connection layer for the whole product',
        text: 'Connected Accounts is not just a setup screen. The connections established there become the destinations available throughout publishing, scheduling and analytics.',
        points: ['Use connected destinations in Posts', 'Reuse them in scheduling workflows', 'Keep platform/account context visible', 'Disconnect and reconnect from one place'],
      },
      {
        title: 'Scale account capacity with the plan',
        text: 'The Trial supports up to two connected accounts. Paid plans scale from five connected accounts on Creator to fifty on Agency.',
        points: ['Trial: up to 2 accounts', 'Creator: up to 5', 'Pro: up to 12', 'Business: up to 25', 'Agency: up to 50'],
      },
      {
        title: 'Nine supported social networks',
        text: 'The current workspace supports Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and X through the production connection layer.',
        points: ['Facebook and Instagram', 'LinkedIn and TikTok', 'YouTube and Pinterest', 'Threads, Bluesky and X'],
      },
    ],
    faqs: [
      ['How many accounts can I connect?', 'The Trial supports 2 connected accounts. Creator supports 5, Pro 12, Business 25 and Agency 50.'],
      ['Which networks can I connect?', 'The current customer-facing set is Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and X.'],
      ['Do I need to select one global active account?', 'The current product direction uses destination selection within publishing and scheduling workflows rather than depending on one global active page for every action.'],
    ],
    related: [
      { label: 'Social media scheduler', href: '/social-media-scheduler' },
      { label: 'Analytics', href: '/analytics' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  'social-media-scheduler': {
    slug: 'social-media-scheduler',
    eyebrow: 'Social media scheduler',
    title: 'Plan and publish across nine networks from one schedule.',
    description: 'Use one INXSocial workspace for post creation, destination selection, scheduling, Bulk Scheduler and Calendar visibility across your connected social accounts.',
    visual: 'scheduler',
    proof: ['Publish now', 'Schedule later', 'Bulk Scheduler', 'Content Calendar', '9 supported networks'],
    sections: [
      {
        title: 'Schedule from the same place you create',
        text: 'Build the post, choose destinations and decide whether to publish now or schedule later without moving between separate products.',
        points: ['Text and media post workflow', 'Carousel publishing workflow', 'Destination selection', 'Schedule and publish controls'],
      },
      {
        title: 'Use Bulk Scheduler when the queue grows',
        text: 'For larger campaigns, move beyond single-post scheduling and prepare multiple media items, captions and time slots together.',
        points: ['Batch campaign preparation', 'Planned slots', 'Multi-destination context', 'Calendar visibility after scheduling'],
      },
      {
        title: 'Keep the schedule connected to analytics',
        text: 'Scheduled and published content stays part of the same INXSocial workspace as Full Analytics, making it easier to review what was published and what happened next.',
        points: ['Content Calendar', 'Publishing status', 'Full Analytics', 'Connected Accounts'],
      },
    ],
    faqs: commonSchedulerFaqs,
    related: [
      { label: 'Facebook scheduler', href: '/facebook-scheduler' },
      { label: 'Instagram scheduler', href: '/instagram-scheduler' },
      { label: 'Bulk Scheduler', href: '/bulk-scheduler' },
    ],
  },
}

const platformDefinitions = [
  ['facebook-scheduler', 'Facebook', 'f', '#1877f2', 'Plan Facebook publishing alongside the rest of your connected social destinations.', 'Keep Facebook destinations in the same workspace as your content, schedule and analytics context.'],
  ['instagram-scheduler', 'Instagram', '◎', '#e1306c', 'Prepare Instagram publishing inside the same workflow as your media library and content schedule.', 'Use one workspace to create visual content, choose the connected Instagram destination and keep the publishing plan visible.'],
  ['linkedin-scheduler', 'LinkedIn', 'in', '#0a66c2', 'Schedule LinkedIn content while keeping professional publishing beside the rest of your social workflow.', 'Prepare copy and media, select the connected LinkedIn destination and keep the schedule connected to analytics context where available.'],
  ['tiktok-scheduler', 'TikTok', '♪', '#25f4ee', 'Plan TikTok publishing from the same workspace used for short-form creation and campaign scheduling.', 'Keep TikTok destination selection beside AI video, Stock Video Creator, scheduling and Calendar visibility.'],
  ['youtube-scheduler', 'YouTube', '▶', '#ff0033', 'Organise YouTube publishing alongside the rest of your connected social schedule.', 'Keep video-focused content, destination context and scheduled publishing inside the same INXSocial workspace.'],
  ['pinterest-scheduler', 'Pinterest', 'p', '#e60023', 'Plan Pinterest publishing without maintaining a separate scheduling workflow.', 'Use the same connected-account, media and schedule system you use for the rest of your social destinations.'],
  ['threads-scheduler', 'Threads', '@', '#f6f7f8', 'Schedule Threads content from the same connected publishing workspace as your other networks.', 'Keep Threads destination selection, copy and timing inside one social content workflow.'],
  ['bluesky-scheduler', 'Bluesky', '∿', '#1685ff', 'Bring Bluesky into the same publishing schedule as your larger social mix.', 'Use one workspace for connected destinations, post preparation, timing and publishing status.'],
  ['x-scheduler', 'X', 'X', '#f8fafc', 'Plan X publishing without separating it from the rest of your campaign schedule.', 'Keep connected X destinations beside your posts, schedule, calendar and measured publishing workflow.'],
] as const

for (const [slug, platform, mark, tone, title, description] of platformDefinitions) {
  acquisitionPages[slug] = {
    slug,
    eyebrow: `${platform} scheduler`,
    title,
    description,
    visual: 'platform',
    platform,
    platformMark: mark,
    platformTone: tone,
    proof: [`${platform} destination`, 'Schedule later', 'Bulk Scheduler', 'Content Calendar', 'One connected workspace'],
    sections: [
      {
        title: `Keep ${platform} inside one publishing system`,
        text: `Connect the supported ${platform} destination and use it alongside the other networks in your INXSocial workspace. The goal is to keep creation, destination choice and scheduling together rather than running a separate tool for every platform.`,
        points: ['Connected destination selection', 'Post creation in INXSocial', 'Publish-now or schedule-later workflow', 'Calendar and publishing-status visibility'],
      },
      {
        title: 'Move from one post to campaign scheduling',
        text: `Single-post scheduling is useful for precise ${platform} publishing. When the campaign gets larger, Bulk Scheduler lets you work with multiple content items and timing rules in one planning session.`,
        points: ['Single-post scheduling', 'Bulk Scheduler included', 'Planned time slots', 'Media Library and AI-created assets'],
      },
      {
        title: `Use ${platform} as part of the wider social mix`,
        text: `INXSocial is designed around nine customer-facing networks, so ${platform} does not need to live in isolation. Keep it beside Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and X as relevant to your workspace.`,
        points: ['Nine supported networks', 'Shared connected-account workspace', 'Full Analytics where provider data is available', 'Same plan and billing system'],
      },
    ],
    faqs: [
      [`Can I schedule ${platform} with INXSocial?`, `INXSocial supports ${platform} as one of its customer-facing social networks. Available publishing behaviour depends on the authorised connection, network permissions and account type.`],
      ...commonSchedulerFaqs,
    ],
    related: [
      { label: 'All social scheduling', href: '/social-media-scheduler' },
      { label: 'Bulk Scheduler', href: '/bulk-scheduler' },
      { label: 'Connected Accounts', href: '/connected-accounts' },
    ],
  }
}

export const acquisitionSlugs = Object.keys(acquisitionPages)
