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
      "Plan, create and schedule social media posts from one workspace with multi-platform publishing, a content calendar, analytics and AI-assisted creation.",
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
        body: "Use the content calendar and scheduled-post views to understand what is coming next before you add more posts to the queue."
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
      "For teams managing higher volumes, Bulk Scheduler provides a separate campaign workflow for preparing many media items and timing rules together."
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
      "Prepare and schedule batches of social media content with INXSocial Bulk Scheduler. Organise media, destinations and timing rules in one campaign workflow.",
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
        title: "Timing rules",
        body: "Build the schedule around your publishing cadence rather than manually calculating every individual slot."
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
        body: "Choose destinations and timing rules that match the campaign rather than rebuilding the same choices for every asset."
      },
      {
        title: "Review outcomes",
        body: "Use publishing status and calendar views to verify what was scheduled and identify anything that still needs attention."
      }
    ],
    detailHeading: "Useful when content volume is the bottleneck",
    details: [
      "Bulk scheduling is particularly useful for short-form video libraries, recurring campaign assets, creator content and planned social calendars where the media already exists before the publishing session begins.",
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
    title: "AI Social Media Tools for Posts, Images & Video | INXSocial",
    metaDescription:
      "Create social media copy, images, carousels, short video and UGC-style assets with AI tools built into the INXSocial publishing workflow.",
    eyebrow: "AI social media tools",
    h1: "Create social content inside the same workspace that publishes it.",
    lead:
      "AI Content Studio connects content generation to the rest of INXSocial so generated media and copy can move into Posts, scheduling and your Media Library without a separate export-and-upload routine.",
    intro: [
      "AI content creation becomes much more useful when it is attached to an actual publishing workflow. A generated image or caption still creates extra work if you have to download it, rename it, upload it somewhere else and rebuild the post.",
      "INXSocial AI Content Studio is designed to keep creation close to the publishing process, covering multiple social formats from one product."
    ],
    highlights: [
      {
        title: "Image posts",
        body: "Create a visual and supporting publishing copy for a social post, then move the result into the wider INXSocial workflow."
      },
      {
        title: "Carousels",
        body: "Prepare coordinated multi-slide social content with slide-level creative structure."
      },
      {
        title: "Video workflows",
        body: "Create short-form video or use stock-video workflows, then keep the resulting media available for publishing."
      }
    ],
    workflowHeading: "Generation connected to publishing",
    workflow: [
      {
        title: "Choose the format",
        body: "Start with Image Post, Carousel Post, Short Video / Reel or UGC Ad Post."
      },
      {
        title: "Create and refine",
        body: "Use the relevant AI-assisted workflow to develop the visual and copy rather than forcing every content type into one generic generator."
      },
      {
        title: "Move into Posts",
        body: "Keep the result inside INXSocial so it can be reviewed, scheduled and published from the same product."
      }
    ],
    detailHeading: "A content studio built around social formats",
    details: [
      "AI Content Studio includes dedicated workflows for Image Post, Carousel Post, Short Video / Reel and UGC Ad Post. Stock Video Creator is available within the video workflow, while AI Video Clipping is presented as a coming-soon capability.",
      "Generated media can remain part of the INXSocial Media Library instead of becoming another folder of disconnected downloads.",
      "AI credits are included according to the selected INXSocial plan. Pricing and included credit volumes are shown on the public pricing page."
    ],
    faq: [
      {
        question: "What can AI Content Studio create?",
        answer:
          "Current workflows cover Image Post, Carousel Post, Short Video / Reel and UGC Ad Post, with stock-video creation available inside the video workflow."
      },
      {
        question: "Can generated content be scheduled afterwards?",
        answer:
          "Yes. The purpose of AI Content Studio is to keep generated assets close to Posts and scheduling so the content can continue through the publishing workflow."
      },
      {
        question: "Does AI Content Studio use credits?",
        answer:
          "Yes. AI creation uses plan-based credits. Included credit amounts vary by subscription tier."
      }
    ],
    related: ["ai-social-media-post-generator", "ai-carousel-post-generator", "ai-video-post-generator"]
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
    title: "AI Social Media Video Generator | INXSocial",
    metaDescription:
      "Create short-form social video and Reel content with AI or stock-video workflows inside INXSocial, then keep the result connected to scheduling and publishing.",
    eyebrow: "AI social video",
    h1: "Create short-form video without separating production from publishing.",
    lead:
      "INXSocial combines AI video and stock-video creation paths with the rest of the social workflow so the finished asset can stay inside the product and continue toward scheduling.",
    intro: [
      "Short-form social video often creates the most fragmented workflow: script in one tool, visuals in another, captions somewhere else and scheduling in a fourth product.",
      "The INXSocial video workflow is designed to reduce those handoffs. Create the video asset, keep it in the Media Library and continue into publishing from the same workspace."
    ],
    highlights: [
      {
        title: "AI video workflow",
        body: "Use an AI-assisted path for short-form social video when generated visuals are the right creative approach."
      },
      {
        title: "Stock Video Creator",
        body: "Use a stock-footage workflow when a sourced-video approach better fits the content."
      },
      {
        title: "Publishing-ready handoff",
        body: "Keep the finished video connected to Media Library, Posts and scheduling rather than exporting it into another system."
      }
    ],
    workflowHeading: "Choose the video route that fits the idea",
    workflow: [
      {
        title: "Plan the content",
        body: "Define the subject, format and intended social destination before generation begins."
      },
      {
        title: "Create the video",
        body: "Use the AI video or stock-video path available inside AI Content Studio."
      },
      {
        title: "Prepare the post",
        body: "Review the finished media and continue into the social publishing workflow."
      }
    ],
    detailHeading: "Video creation designed for social workflows",
    details: [
      "The video experience focuses on short-form social outputs such as Reels and similar vertical content. Available dimensions and publishing support depend on the selected workflow and destination.",
      "Stock Video Creator is part of the existing video workflow. AI Video Clipping is separately identified in the product as a coming-soon capability.",
      "AI video usage is governed by the credit allowance attached to the selected INXSocial plan."
    ],
    faq: [
      {
        question: "Does INXSocial offer AI-generated video?",
        answer:
          "AI Content Studio includes a short-form video workflow and also provides a stock-video creation path."
      },
      {
        question: "Can I keep generated videos in the Media Library?",
        answer:
          "Generated media is designed to remain available inside the INXSocial media workflow so it can be reused or moved into publishing."
      },
      {
        question: "Is AI Video Clipping available now?",
        answer:
          "The public product currently presents AI Video Clipping as coming soon."
      }
    ],
    related: ["ai-social-media-tools", "social-media-scheduler", "pricing"]
  },

  "ai-ugc-ad-generator": {
    slug: "ai-ugc-ad-generator",
    title: "AI UGC Ad Generator for Social Campaigns | INXSocial",
    metaDescription:
      "Create UGC-style social ad concepts and promotional assets with AI in INXSocial, then move the finished creative into your publishing workflow.",
    eyebrow: "AI UGC ad generator",
    h1: "Develop creator-style promotional content inside your social publishing workspace.",
    lead:
      "UGC Ad Post is a dedicated AI Content Studio workflow for building creator-style promotional content around a product, service or campaign brief.",
    intro: [
      "UGC-style advertising is different from a standard brand graphic. It usually needs a stronger hook, a more direct product story and creative that feels native to the social feed.",
      "INXSocial gives that format its own creation workflow, keeping the resulting media and publishing copy close to the rest of your campaign operations."
    ],
    highlights: [
      {
        title: "Creator-style format",
        body: "Start from the product, service or campaign message and build content around a social-first promotional structure."
      },
      {
        title: "Creative + publishing copy",
        body: "Develop the asset and supporting social copy together instead of handing the output between disconnected tools."
      },
      {
        title: "Campaign continuity",
        body: "Keep the result inside INXSocial so it can move into Posts, Media Library and scheduling."
      }
    ],
    workflowHeading: "From promotional idea to publishable social asset",
    workflow: [
      {
        title: "Define the offer",
        body: "Describe the product, service or campaign point the creative needs to communicate."
      },
      {
        title: "Build the UGC-style concept",
        body: "Use the dedicated workflow to create a social-native promotional direction."
      },
      {
        title: "Review and schedule",
        body: "Refine the result before moving the finished content into publishing."
      }
    ],
    detailHeading: "A dedicated format inside a broader content studio",
    details: [
      "UGC Ad Post sits alongside Image Post, Carousel Post and Short Video / Reel, giving promotional content a dedicated path without forcing every campaign into the same template.",
      "The workflow is intended for AI-assisted creative development. Users should still review claims, product details and campaign compliance before publishing.",
      "The final asset remains part of the INXSocial social workflow rather than a standalone advertising project."
    ],
    faq: [
      {
        question: "What is UGC-style content?",
        answer:
          "UGC-style content is promotional creative designed to feel closer to creator-native social content than a traditional polished brand advertisement."
      },
      {
        question: "Can I edit the UGC-style result?",
        answer:
          "Yes. AI-assisted outputs should be reviewed and refined before publication, especially for product claims and campaign details."
      },
      {
        question: "Can I schedule the finished creative?",
        answer:
          "Yes. The workflow is integrated with the wider INXSocial publishing system."
      }
    ],
    related: ["ai-social-media-tools", "ai-video-post-generator", "social-media-scheduler"]
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
