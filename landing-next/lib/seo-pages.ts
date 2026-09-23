export type SeoHighlight = {
  title: string;
  body: string;
};

export type SeoFaq = {
  question: string;
  answer: string;
};

export type SeoPage = {
  slug: string;
  title: string;
  metaDescription: string;
  eyebrow: string;
  h1: string;
  lead: string;
  intro: string[];
  highlights: SeoHighlight[];
  workflowHeading: string;
  workflow: SeoHighlight[];
  detailHeading: string;
  details: string[];
  faq: SeoFaq[];
  related: string[];
};

export const seoPages: Record<string, SeoPage> = {
  "social-media-scheduler": {
    slug: "social-media-scheduler",
    title: "Social Media Scheduler for Multiple Platforms | INXSocial",
    metaDescription:
      "Plan, create and schedule social media posts with multi-platform publishing, Smart Timing, content calendar, analytics and AI-assisted creation in INXSocial.",
    eyebrow: "Social media scheduler",
    h1: "Schedule social media without rebuilding the same workflow for every platform.",
    lead:
      "INXSocial brings post creation, scheduling, connected accounts, content planning and publishing status into one workspace so creators, businesses and agencies can run a repeatable social workflow.",
    intro: [
      "A useful social media scheduler should do more than hold a date and time. It should help you prepare the post, choose the right destinations, understand what is already scheduled and keep the publishing state visible after the post leaves your screen.",
      "INXSocial is designed around that complete workflow. Create a post, select connected destinations, publish immediately or schedule ahead, then review scheduled and published activity from the same product."
    ],
    highlights: [
      {
        title: "One publishing workspace",
        body: "Prepare captions and media, select connected destinations and manage publishing from one interface instead of repeating the same setup in multiple network dashboards."
      },
      {
        title: "Schedule with context",
        body: "Use scheduled-post views and the content calendar to understand what is coming next, with optional Smart Timing available for supported Bulk Scheduler campaigns."
      },
      {
        title: "Create before you schedule",
        body: "Move from AI-assisted content creation or your Media Library into the publishing workflow without exporting assets into a separate scheduling tool."
      }
    ],
    workflowHeading: "From idea to scheduled post",
    workflow: [
      {
        title: "Create",
        body: "Write the caption, add media and review the post before it is sent anywhere."
      },
      {
        title: "Choose destinations",
        body: "Select the connected social accounts relevant to that post. Supported capabilities vary by network permissions and account type."
      },
      {
        title: "Set the timing",
        body: "Publish now or choose a future date and time, then review the result in your scheduling and calendar views."
      }
    ],
    detailHeading: "Built for an ongoing publishing routine",
    details: [
      "INXSocial supports Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and X within the connected-account experience. Publishing, feed and analytics support varies by each network's API permissions and account type.",
      "The scheduler works alongside Bulk Scheduler, Content Calendar, Media Library, Analytics and AI Content Studio. That matters when the job is not just publishing one post, but keeping a whole content operation organised over days or weeks.",
      "For teams managing higher volumes, Bulk Scheduler can load saved AI Campaigns, prepare media and text batches, and optionally apply Smart Timing while keeping the exact chosen timestamps visible in Calendar."
    ],
    faq: [
      {
        question: "Can I schedule posts to multiple social platforms?",
        answer:
          "You can work with multiple connected social destinations inside INXSocial. The exact publishing options available depend on the network, the account type and the permissions granted by that platform."
      },
      {
        question: "Can I see scheduled posts in a calendar?",
        answer:
          "Yes. Content Calendar is designed to show planned, scheduled and published activity so you can see how the month is taking shape."
      },
      {
        question: "Does INXSocial include content creation as well as scheduling?",
        answer:
          "Yes. Post creation, Media Library and AI Content Studio sit alongside scheduling so media and copy can move into the publishing workflow without a separate tool."
      }
    ],
    related: ["bulk-social-media-scheduler", "social-media-content-calendar", "pricing"]
  },

  "bulk-social-media-scheduler": {
    slug: "bulk-social-media-scheduler",
    title: "Bulk Social Media Scheduler for Campaigns | INXSocial",
    metaDescription:
      "Prepare and schedule batches with AI Campaign mode, Smart Timing, mixed text and image posts, destination controls and calendar visibility in INXSocial.",
    eyebrow: "Bulk scheduling",
    h1: "Schedule a complete content batch without opening a new post form every time.",
    lead:
      "Bulk Scheduler is built for creators, brands and agencies that already have a folder of content ready and need a faster way to turn that media into an organised publishing plan.",
    intro: [
      "Scheduling one post at a time becomes expensive in attention long before it becomes technically difficult. The repeated steps are the problem: upload, caption, select destinations, choose a time, confirm, then start again.",
      "INXSocial Bulk Scheduler groups that work into a campaign-style flow so multiple media items can be prepared together and moved into an organised schedule."
    ],
    highlights: [
      {
        title: "Batch-first workflow",
        body: "Start with multiple media items instead of creating a separate publishing form for every file."
      },
      {
        title: "Smart Timing",
        body: "Keep your chosen publishing cadence while optional Smart Timing analyses the batch and applies bounded minute-level variation, with the selected times visible in Calendar."
      },
      {
        title: "Status visibility",
        body: "Keep uploaded, scheduled and failed items visible so a large batch does not become a black box after submission."
      }
    ],
    workflowHeading: "A cleaner way to prepare high-volume publishing",
    workflow: [
      {
        title: "Add the batch",
        body: "Bring the campaign media into one preparation flow and review the items before scheduling."
      },
      {
        title: "Define the plan",
        body: "Choose destinations and timing rules, or load a saved AI Campaign with its text, image or mixed post sequence preserved for scheduling."
      },
      {
        title: "Review outcomes",
        body: "Use publishing status and calendar views to verify what was scheduled and identify anything that still needs attention."
      }
    ],
    detailHeading: "Useful when content volume is the bottleneck",
    details: [
      "Bulk scheduling can start from uploaded media, text posts or a saved AI Campaign. Mixed AI campaigns keep their original text/image sequence and compatible destination routing when they enter the scheduler.",
      "The rest of the INXSocial workspace remains available around the batch: Media Library keeps reusable assets organised, Content Calendar shows how the schedule lands across the month and Analytics helps you review performance after publishing.",
      "The product is designed to preserve clear failure and review states rather than treating a batch as successful simply because it was submitted."
    ],
    faq: [
      {
        question: "What is the difference between Scheduler and Bulk Scheduler?",
        answer:
          "The standard publishing flow is useful for preparing individual posts. Bulk Scheduler is designed for preparing many media items and timing rules together in one campaign-style workflow."
      },
      {
        question: "Can I use videos in a bulk schedule?",
        answer:
          "Bulk Scheduler is designed to work with supported media types in the INXSocial publishing workflow, including video where the connected network permits it."
      },
      {
        question: "Can I review a bulk schedule afterwards?",
        answer:
          "Yes. Scheduled content remains part of the wider INXSocial scheduling and calendar experience so you can review what is planned."
      }
    ],
    related: ["social-media-scheduler", "social-media-content-calendar", "social-media-analytics"]
  },

  "social-media-content-calendar": {
    slug: "social-media-content-calendar",
    title: "Social Media Content Calendar & Planner | INXSocial",
    metaDescription:
      "Plan and review social content in a visual calendar. See scheduled, draft, published and failed activity across connected accounts with INXSocial.",
    eyebrow: "Content calendar",
    h1: "See the month before it happens.",
    lead:
      "INXSocial Content Calendar gives your publishing plan a visual home, so scheduled posts, drafts and publishing outcomes are easier to understand than a list of disconnected timestamps.",
    intro: [
      "A content calendar is most useful when it reflects what the publishing system is actually doing. Planning in a spreadsheet and scheduling in a separate tool creates two versions of the truth.",
      "INXSocial keeps the calendar inside the same workspace as post creation, scheduling and publishing status. That lets the calendar become an operational view rather than a separate planning document."
    ],
    highlights: [
      {
        title: "Visual month view",
        body: "Review upcoming content across dates instead of reading a long queue of scheduled timestamps."
      },
      {
        title: "Publishing states",
        body: "Keep drafts, scheduled posts, published content and failures visible in the same planning context."
      },
      {
        title: "Connected workflow",
        body: "Move between calendar, posts, scheduling and analytics without maintaining a second content plan elsewhere."
      }
    ],
    workflowHeading: "Plan, schedule, review",
    workflow: [
      {
        title: "Plan the cadence",
        body: "Use the month view to identify busy days, empty periods and campaign clusters."
      },
      {
        title: "Open the content",
        body: "Move from the calendar into the related publishing item when you need to check or adjust the post."
      },
      {
        title: "Keep status visible",
        body: "Use clear publishing states to understand what is planned, what has gone live and what requires attention."
      }
    ],
    detailHeading: "A calendar tied to real publishing data",
    details: [
      "The INXSocial calendar is part of the operational product rather than a downloadable template. It is designed to reflect the posts being created and scheduled in the workspace.",
      "For higher-volume workflows, Bulk Scheduler can populate future content while the calendar provides the visual check that the resulting cadence still makes sense.",
      "The calendar also complements Analytics: planning shows what was intended, while performance reporting helps you understand what happened after publication."
    ],
    faq: [
      {
        question: "Does the calendar show more than scheduled posts?",
        answer:
          "The INXSocial calendar is designed to surface publishing states such as drafts, scheduled content, published posts and failures."
      },
      {
        question: "Can I use the calendar with bulk scheduling?",
        answer:
          "Yes. Bulk Scheduler and Content Calendar are part of the same workspace, so batch-planned content can be reviewed in the broader schedule."
      },
      {
        question: "Is this a downloadable content calendar template?",
        answer:
          "No. It is an in-product calendar connected to the INXSocial publishing workflow."
      }
    ],
    related: ["bulk-social-media-scheduler", "social-media-scheduler", "social-media-analytics"]
  },

  "social-media-analytics": {
    slug: "social-media-analytics",
    title: "Social Media Analytics & Reporting Dashboard | INXSocial",
    metaDescription:
      "Track publishing activity, engagement, platform distribution and content performance from one social media analytics and reporting dashboard.",
    eyebrow: "Social media analytics",
    h1: "Understand what happened after the post was published.",
    lead:
      "INXSocial Analytics brings publishing activity and performance context into the same workspace you use to create and schedule content.",
    intro: [
      "Reporting is easier to act on when it sits next to the workflow that produced the content. Instead of treating analytics as a monthly export, INXSocial keeps performance visible inside the product.",
      "The dashboard is designed to help you understand publishing volume, engagement and platform distribution while keeping the underlying social workflow close at hand."
    ],
    highlights: [
      {
        title: "Publishing activity",
        body: "Review how much content has been published or scheduled over the selected period."
      },
      {
        title: "Platform distribution",
        body: "See how posting activity is spread across connected social destinations."
      },
      {
        title: "Content performance",
        body: "Use engagement and top-content views to identify which published items deserve a closer look."
      }
    ],
    workflowHeading: "Use reporting to improve the next publishing cycle",
    workflow: [
      {
        title: "Review",
        body: "Check recent publishing activity and performance signals across your connected workspace."
      },
      {
        title: "Compare",
        body: "Look at platform distribution and stronger-performing content instead of evaluating posts in isolation."
      },
      {
        title: "Apply",
        body: "Take those observations back into your planning, creation and scheduling workflow."
      }
    ],
    detailHeading: "Analytics without leaving the publishing system",
    details: [
      "INXSocial is not positioned as a standalone enterprise social-listening product. Its analytics are designed to support everyday publishing decisions inside the same workspace as posts, scheduling and content creation.",
      "Available analytics depend on the data and permissions each connected social network exposes through its API.",
      "For creators and teams, the value is operational continuity: planning, publishing and reviewing performance happen in one product rather than across several disconnected tools."
    ],
    faq: [
      {
        question: "What can I see in INXSocial Analytics?",
        answer:
          "The product includes views for publishing activity, engagement context, platform distribution and stronger-performing content. Exact metrics vary by connected network."
      },
      {
        question: "Do analytics work for every connected platform?",
        answer:
          "Analytics depend on each network's API, permissions and account type, so the available data can vary by platform."
      },
      {
        question: "Can analytics help with scheduling decisions?",
        answer:
          "The analytics workspace is intended to feed observations back into planning and scheduling so you can refine future content."
      }
    ],
    related: ["social-media-content-calendar", "social-media-scheduler", "pricing"]
  },

  "ai-social-media-tools": {
    slug: "ai-social-media-tools",
    title: "AI Social Media Tools for Campaigns, Images & Video | INXSocial",
    metaDescription:
      "Create social media copy, campaigns, images, carousels, UGC video and short-form video with AI tools built directly into the INXSocial publishing workflow.",
    eyebrow: "AI social media tools",
    h1: "Create campaigns and content inside the same workspace that publishes it.",
    lead:
      "AI Content Studio connects campaign generation, image and carousel creation, UGC Studio and AI video to the rest of INXSocial so generated work can move into Posts, Media Library and Bulk Scheduler without a separate export routine.",
    intro: [
      "AI content creation becomes more useful when it is attached to an actual publishing workflow. A generated campaign, video or image still creates extra work if it has to be downloaded, renamed and rebuilt somewhere else.",
      "INXSocial keeps creation close to publishing, with dedicated workflows for campaign planning, images, carousels, UGC video, text-to-video, image-to-video and stock-video production."
    ],
    highlights: [
      {
        title: "AI Campaign",
        body: "Turn a campaign goal and optional website into a structured 10, 15, 20 or 30-post text, image or mixed campaign, then review it before Bulk Scheduler handoff."
      },
      {
        title: "UGC Studio",
        body: "Build creator-led UGC video campaigns from a website, SaaS product, physical product or brief using reusable creators, product references, variations and editing."
      },
      {
        title: "Image, carousel and video",
        body: "Generate image posts, coordinated carousels and short-form video, including text-to-video and image-to-video routes, while keeping the finished media inside INXSocial."
      }
    ],
    workflowHeading: "Generation connected to publishing",
    workflow: [
      {
        title: "Choose the workflow",
        body: "Start with AI Campaign, Image Post, Carousel Post, Short Video / Reel or UGC Studio according to what you need to produce."
      },
      {
        title: "Create and review",
        body: "Use the specialised workflow for the format, review the generated output and keep brand, product and campaign details under your control."
      },
      {
        title: "Move into publishing",
        body: "Continue into Posts or Bulk Scheduler, choose destinations and timing, and keep the resulting media available in the same workspace."
      }
    ],
    detailHeading: "A content studio built around real social workflows",
    details: [
      "AI Campaign can create text-only, image-only or mixed campaigns and can analyse an optional business or product website for grounded strategy and creative direction.",
      "UGC Studio supports reusable creators, product-reference uploads, multiple variations, background rendering and a post-generation editor. Short Video / Reel supports both text-to-video and image-to-video alongside Stock Video Creator.",
      "AI generation uses the shared plan-based credit system. The product calculates credit exposure before generation where the workflow can create multiple paid assets."
    ],
    faq: [
      {
        question: "What can AI Content Studio create?",
        answer:
          "Current workflows cover AI Campaign, Image Post, Carousel Post, Short Video / Reel and UGC Studio. Video can start from text or an image reference, and Stock Video Creator is also available."
      },
      {
        question: "Can an AI campaign be scheduled as a batch?",
        answer:
          "Yes. Saved AI Campaigns can be loaded directly in Bulk Scheduler while preserving their text, image or mixed post sequence for final destination and timing choices."
      },
      {
        question: "Does AI Content Studio use credits?",
        answer:
          "Yes. AI creation uses the shared plan-based credit wallet. The exact cost depends on the generation workflow and selected configuration."
      }
    ],
    related: ["ai-social-media-campaign-generator", "ai-video-post-generator", "ai-ugc-ad-generator"]
  },

  "ai-social-media-campaign-generator": {
    slug: "ai-social-media-campaign-generator",
    title: "AI Social Media Campaign Generator | INXSocial",
    metaDescription:
      "Generate complete social campaigns with strategy, text and image posts, website brand grounding, review, Bulk Scheduler handoff and Smart Timing in INXSocial.",
    eyebrow: "AI social media campaign generator",
    h1: "Generate a complete social campaign, review it, then schedule it as one workflow.",
    lead:
      "INXSocial AI Campaign turns a campaign goal and optional website into a structured 10, 15, 20 or 30-post campaign with text, image or mixed content and a direct handoff to Bulk Scheduler.",
    intro: [
      "A campaign generator should do more than produce a pile of unrelated captions. INXSocial first builds campaign strategy, content pillars and a post map so the sequence has a deliberate role before individual posts are written.",
      "When a website is supplied, the workflow can use verified website evidence and visual references to ground campaign messaging and generated imagery in the real brand instead of inventing a replacement identity."
    ],
    highlights: [
      {
        title: "Strategy before posts",
        body: "Generate campaign direction, content pillars, hook rotation and a structured post map before the individual text and image posts are produced."
      },
      {
        title: "Brand-grounded image campaigns",
        body: "Use verified website logos, product visuals, screenshots and brand colours as authoritative inputs. When a verified full logo exists, INXSocial can preserve the exact logo instead of asking the image model to redraw it."
      },
      {
        title: "Campaign-to-schedule handoff",
        body: "Save the campaign, review every post and generated image, then load the authoritative campaign directly into Bulk Scheduler for destination and timing decisions."
      }
    ],
    workflowHeading: "From campaign brief to scheduled batch",
    workflow: [
      {
        title: "Define the campaign",
        body: "Choose the campaign goal, optional website, target platform context and a 10, 15, 20 or 30-post text, image or mixed campaign."
      },
      {
        title: "Review the generated plan",
        body: "Inspect the strategy, content pillars, hooks, captions, hashtags and generated visuals. Individual posts and images remain reviewable and regenerable."
      },
      {
        title: "Schedule the campaign",
        body: "Open the saved campaign in Bulk Scheduler, choose compatible destinations and timing, and optionally use Smart Timing for bounded variation around the selected schedule."
      }
    ],
    detailHeading: "Built to preserve campaign continuity",
    details: [
      "Text-only, image-only and mixed campaigns remain saved in INXSocial so the campaign can be reopened, reviewed and handed to Bulk Scheduler again without rebuilding a temporary media bundle.",
      "Website analysis can extract official visual references such as logos, hero images, product screenshots and relevant interface visuals through the existing safe public-asset retrieval path. Generated campaign images are instructed not to invent substitute logos or fictional product interfaces when verified references exist.",
      "Image generation follows the shared AI credit system. Multi-image campaigns surface the required image-credit exposure before generation begins, and failed renders remain retryable."
    ],
    faq: [
      {
        question: "How many posts can an AI Campaign create?",
        answer:
          "The current AI Campaign workflow supports 10, 15, 20 or 30-post campaigns."
      },
      {
        question: "Can AI Campaign create both text and image posts?",
        answer:
          "Yes. You can create text-only, image-only or mixed campaigns, and mixed campaigns preserve the original post order when they move into Bulk Scheduler."
      },
      {
        question: "Can INXSocial use my website branding in campaign images?",
        answer:
          "Yes. When verified website references are available, INXSocial can use official logos, product visuals, screenshots and brand colours as grounded creative inputs rather than inventing replacements."
      }
    ],
    related: ["bulk-social-media-scheduler", "ai-social-media-tools", "social-media-scheduler"]
  },

  "ai-social-media-post-generator": {
    slug: "ai-social-media-post-generator",
    title: "AI Social Media Post Generator & Scheduler | INXSocial",
    metaDescription:
      "Generate social media post ideas, captions and visual content with AI, then move the finished post directly into scheduling with INXSocial.",
    eyebrow: "AI post generator",
    h1: "Turn an idea into a social post that is already connected to scheduling.",
    lead:
      "Use AI-assisted creation to develop the post, refine the copy and visual, then continue into the INXSocial publishing workflow without starting again in another tool.",
    intro: [
      "A useful AI social media post generator should reduce the complete path from idea to publication, not only produce a paragraph of text.",
      "INXSocial combines AI-assisted content creation with post preparation, Media Library and scheduling so the generated work can continue through the same operational workflow."
    ],
    highlights: [
      {
        title: "Start from an idea",
        body: "Use a short concept or publishing goal as the starting point for AI-assisted content development."
      },
      {
        title: "Build visual + copy",
        body: "Create the media and supporting publishing text within the same content workflow."
      },
      {
        title: "Schedule the result",
        body: "Move the completed post into Posts and scheduling without downloading and rebuilding the content elsewhere."
      }
    ],
    workflowHeading: "More than a caption box",
    workflow: [
      {
        title: "Define",
        body: "Start with the subject, campaign idea or content objective you want the post to communicate."
      },
      {
        title: "Generate",
        body: "Develop the copy and relevant visual format using the appropriate AI Content Studio workflow."
      },
      {
        title: "Publish",
        body: "Review destinations and timing in INXSocial before the post goes live."
      }
    ],
    detailHeading: "Designed for real social publishing",
    details: [
      "Different social formats need different creative structures, so INXSocial separates image, carousel, video and UGC-style workflows rather than treating every output as plain text.",
      "Generated assets can stay available through Media Library, which makes reuse easier when you are building a wider campaign.",
      "Network-specific publishing options still depend on the connected account and the permissions available from each platform."
    ],
    faq: [
      {
        question: "Can the AI post generator create images as well as captions?",
        answer:
          "AI Content Studio includes image-focused workflows as well as copy assistance, so visual and written content can be developed together."
      },
      {
        question: "Can I edit the result before publishing?",
        answer:
          "Yes. Generated content is intended to be reviewed and refined before it moves into the publishing flow."
      },
      {
        question: "Can I schedule the generated post?",
        answer:
          "Yes. Generated content can continue into INXSocial Posts and scheduling."
      }
    ],
    related: ["ai-social-media-tools", "social-media-scheduler", "ai-carousel-post-generator"]
  },

  "ai-carousel-post-generator": {
    slug: "ai-carousel-post-generator",
    title: "AI Social Media Carousel Generator | INXSocial",
    metaDescription:
      "Create coordinated social media carousel content with AI inside INXSocial, then review slides and move the finished carousel into your publishing workflow.",
    eyebrow: "AI carousel generator",
    h1: "Build a coordinated carousel instead of generating disconnected slides.",
    lead:
      "The Carousel Post workflow is designed around multi-slide social storytelling, helping you develop a consistent sequence before the content moves into publishing.",
    intro: [
      "Carousel content has structure: an opening slide needs to earn attention, the middle slides need to carry the idea and the final slide needs to resolve it. Treating every slide as an independent image usually creates a weaker result.",
      "INXSocial's carousel workflow keeps the slides together as one content unit so the creative and publishing process remains coherent."
    ],
    highlights: [
      {
        title: "Multi-slide structure",
        body: "Develop a sequence of slides around one idea rather than creating unrelated visuals."
      },
      {
        title: "Slide-level control",
        body: "Review the individual slides and their supporting copy before the carousel enters publishing."
      },
      {
        title: "Publishing continuity",
        body: "Keep the finished carousel connected to Posts, Media Library and scheduling in INXSocial."
      }
    ],
    workflowHeading: "A carousel is a sequence, not a folder",
    workflow: [
      {
        title: "Set the idea",
        body: "Define the subject, offer or educational story the carousel needs to communicate."
      },
      {
        title: "Build the sequence",
        body: "Create coordinated slide content and review how the message moves from one frame to the next."
      },
      {
        title: "Prepare for publishing",
        body: "Move the completed carousel into the wider INXSocial post workflow."
      }
    ],
    detailHeading: "Useful for educational, campaign and product content",
    details: [
      "Carousel posts are well suited to step-by-step explanations, product stories, campaign messages and educational content where one frame is not enough.",
      "INXSocial keeps carousel creation alongside other social formats so you can choose the right format for the idea without leaving the publishing system.",
      "Platform support for carousel publishing depends on the connected network and the options exposed through its API."
    ],
    faq: [
      {
        question: "Can I review each carousel slide?",
        answer:
          "The carousel workflow is designed around a multi-slide content unit so individual slides can be reviewed as part of the sequence."
      },
      {
        question: "Can carousel content be scheduled?",
        answer:
          "When the connected platform supports the required carousel publishing format, the finished content can continue through the INXSocial publishing workflow."
      },
      {
        question: "Is the carousel generator part of AI Content Studio?",
        answer:
          "Yes. Carousel Post is one of the dedicated AI Content Studio workflows."
      }
    ],
    related: ["ai-social-media-tools", "ai-social-media-post-generator", "social-media-scheduler"]
  },

  "ai-video-post-generator": {
    slug: "ai-video-post-generator",
    title: "AI Social Media Video & Image-to-Video Generator | INXSocial",
    metaDescription:
      "Create short social videos from text or a reference image with AI model routing, image-to-video controls, background rendering and direct publishing in INXSocial.",
    eyebrow: "AI social video generator",
    h1: "Create short-form video from a prompt or reference image without leaving your social workflow.",
    lead:
      "INXSocial AI Video Studio supports text-to-video and image-to-video generation, automatic or manual model routing, configurable output controls and background rendering before the finished asset moves into Media Library and publishing.",
    intro: [
      "Short-form video often becomes a fragmented workflow: the brief lives in one tool, references in another, the render somewhere else and publishing in a fourth product.",
      "INXSocial keeps the generation path inside the same workspace. Start from text, a product image, screenshot or first-frame reference, generate in the background, then continue with the finished video without rebuilding the post elsewhere."
    ],
    highlights: [
      {
        title: "Text-to-video or image-to-video",
        body: "Generate from a written brief alone or add a reference image, product shot, screenshot or first frame to anchor the visual direction."
      },
      {
        title: "Smart model routing",
        body: "Use AI Recommended for quality-to-cost model selection, Fast for a lower-cost everyday route, or Manual when you want direct control over the available generation model."
      },
      {
        title: "Publishing-ready output",
        body: "Choose supported duration, resolution, aspect ratio and audio options, let longer renders continue in the background, then keep the finished video inside Media Library and Posts."
      }
    ],
    workflowHeading: "From brief to social-ready video",
    workflow: [
      {
        title: "Describe the video",
        body: "Write the creative brief and optionally provide a product URL or reference image for stronger visual grounding."
      },
      {
        title: "Choose or let AI route the model",
        body: "Use AI Recommended, Fast or Manual mode, then configure the supported duration, resolution, aspect ratio, audio and draft options."
      },
      {
        title: "Generate and publish",
        body: "Rendering can continue in the background. Review the completed video and post package, save it to the media workflow or continue directly to Post / Schedule."
      }
    ],
    detailHeading: "Video generation designed around social production",
    details: [
      "The current generative video workflow exposes several video-generation routes behind a consistent INXSocial interface. Model availability, supported dimensions, duration and audio capability vary by route.",
      "Reference-image generation is supported where the selected model permits it, giving users a practical image-to-video path for product shots, screenshots and first-frame creative.",
      "Stock Video Creator remains available as a separate production path inside Short Video / Reel. AI Video Clipping is still presented as coming soon and is not described as generally available."
    ],
    faq: [
      {
        question: "Can I generate video from an image in INXSocial?",
        answer:
          "Yes. The AI video workflow can accept an image, product shot, screenshot or first-frame reference and use it with supported image-reference video models."
      },
      {
        question: "Can INXSocial choose the video model automatically?",
        answer:
          "Yes. AI Recommended analyses the brief and whether a reference image is present, then selects a supported model based on quality-to-cost and production needs. Fast and Manual modes are also available."
      },
      {
        question: "Can video generation continue if I close the window?",
        answer:
          "Yes. The current video workflow supports background generation and keeps progress available through the product while the render continues."
      }
    ],
    related: ["ai-social-media-tools", "ai-ugc-ad-generator", "social-media-scheduler"]
  },

  "ai-ugc-ad-generator": {
    slug: "ai-ugc-ad-generator",
    title: "AI UGC Video Generator & Ad Creator | INXSocial",
    metaDescription:
      "Create UGC video ads with AI creators, product references, brand-aware generation, multiple variations and editing inside the INXSocial publishing workflow.",
    eyebrow: "AI UGC video generator",
    h1: "Create complete UGC video ads with reusable AI creators and real product references.",
    lead:
      "INXSocial UGC Studio is a guided campaign workspace for creator-led video ads, covering source understanding, creative direction, creator selection, video generation, variations, editing and scheduling from one product.",
    intro: [
      "UGC production needs more continuity than a one-shot video prompt. The creator should stay visually consistent, the product should remain recognisable and the narration, lip sync and scene progression should belong to the same ad.",
      "UGC Studio is designed around that complete workflow. Start from a website or SaaS product, a physical product with uploaded references, or a campaign brief, then build and manage the resulting UGC campaign inside INXSocial."
    ],
    highlights: [
      {
        title: "Reusable creator library",
        body: "Choose from the featured system creator library or reuse user-uploaded and user-generated creators. Creator identity is kept consistent across the generated ad."
      },
      {
        title: "Product and brand grounding",
        body: "Physical-product flows can use uploaded product references, while website-led flows can use verified product and brand visuals before generation."
      },
      {
        title: "Variations + editor",
        body: "Create 15, 20 or 30-second ads with multiple variations, Standard or Premium generation, then edit script, voice, delivery, music, captions, CTA and selected scenes."
      }
    ],
    workflowHeading: "A guided UGC campaign from source to finished ad",
    workflow: [
      {
        title: "Define the source and brand",
        body: "Start from Website / SaaS, Physical Product or Brief. Physical products can include up to eight real product references for the generation workflow."
      },
      {
        title: "Choose the creative direction",
        body: "Select the ad style, creator, video length, number of variations and generation tier while keeping the credit requirement visible before rendering."
      },
      {
        title: "Render, edit and schedule",
        body: "Campaigns continue rendering in the background, remain available from the UGC Studio home, and can move through the editor before scheduling."
      }
    ],
    detailHeading: "UGC Studio is now a persistent campaign workspace",
    details: [
      "UGC Studio has a dedicated home for ready, rendering and failed campaigns, campaign variations, reusable creators and approved sample videos. Existing campaigns can be reopened, edited, scheduled, duplicated or deleted from that workspace.",
      "Creator scenes reuse one stored creator reference and one narrator identity through the ad. Product Showcase prioritises uploaded product references and verified website visuals instead of inventing a replacement product.",
      "Generation uses the shared AI credit system with visible Standard and Premium pricing by duration and variation count. Existing reserve, completion and refund accounting remains part of the credit workflow."
    ],
    faq: [
      {
        question: "Can I use my own product images in a UGC ad?",
        answer:
          "Yes. Physical-product campaigns can upload up to eight product references, and Product Showcase is designed to use real product visuals rather than inventing one."
      },
      {
        question: "Can I create multiple UGC variations?",
        answer:
          "Yes. The current workflow supports 1, 5, 10, 15 or 20 variations with 15, 20 or 30-second video lengths."
      },
      {
        question: "Can I edit a generated UGC video?",
        answer:
          "Yes. Editor V1 supports changes to creator, script, voice and delivery, music, captions, CTA and selective scene or full regeneration before the content moves onward."
      }
    ],
    related: ["ai-social-media-campaign-generator", "ai-video-post-generator", "ai-social-media-tools"]
  },

  pricing: {
    slug: "pricing",
    title: "INXSocial Pricing | Social Media Scheduler Plans",
    metaDescription:
      "Compare INXSocial plans for creators, businesses and agencies, including connected accounts, scheduling, analytics and AI Content Studio credits.",
    eyebrow: "INXSocial pricing",
    h1: "Choose the publishing capacity and AI credits that fit your workflow.",
    lead:
      "INXSocial plans scale by connected-account capacity and monthly AI credits while keeping the core publishing workflow in one product.",
    intro: [
      "The right plan depends on how many social accounts you need to connect, how much AI-assisted content you expect to create and the volume of publishing your workflow requires.",
      "All prices shown below are the current public monthly prices in GBP. Billing details and checkout are handled through Stripe."
    ],
    highlights: [
      {
        title: "Creator — £18.99/month",
        body: "For individual creators: up to 5 connected accounts, unlimited posts and scheduling, Analytics, AI captions, full AI Content Studio and 150 AI credits per month."
      },
      {
        title: "Pro — £34.99/month",
        body: "For growing businesses: up to 12 connected accounts, unlimited posts and scheduling, full Analytics and AI Content Studio, 500 AI credits and priority support."
      },
      {
        title: "Business & Agency",
        body: "Business is £59.99/month for up to 25 connected accounts and 1,200 AI credits. Agency is £99.99/month for up to 50 connected accounts and 2,500 AI credits."
      }
    ],
    workflowHeading: "Start before you commit",
    workflow: [
      {
        title: "7-day trial",
        body: "Try the connected publishing workflow before choosing a paid plan. The public site states that no card is required for the trial."
      },
      {
        title: "Choose capacity",
        body: "Select the connected-account allowance and AI credit volume that match your current operation."
      },
      {
        title: "Scale when needed",
        body: "Move to a higher plan as account volume or AI-assisted production increases."
      }
    ],
    detailHeading: "What the paid plans are built around",
    details: [
      "Creator, Pro, Business and Agency all include unlimited posts and scheduling together with Analytics, AI captions and full AI Content Studio access.",
      "The main published differences are connected-account capacity, AI credit allowance and support level.",
      "AI generation consumes credits according to the content workflow and provider cost. The product interface shows the user's available credit balance."
    ],
    faq: [
      {
        question: "Is there a free trial?",
        answer:
          "Yes. The current public offer is a 7-day trial with no card required."
      },
      {
        question: "Are posts and scheduling limited on paid plans?",
        answer:
          "The current public plan descriptions list unlimited posts and scheduling on Creator, Pro, Business and Agency."
      },
      {
        question: "How are AI credits included?",
        answer:
          "Creator includes 150 monthly AI credits, Pro 500, Business 1,200 and Agency 2,500 according to the current public pricing."
      }
    ],
    related: ["social-media-scheduler", "ai-social-media-tools", "bulk-social-media-scheduler"]
  }
};

export const seoPageSlugs = Object.keys(seoPages);

export function getSeoPage(slug: string) {
  return seoPages[slug];
}
