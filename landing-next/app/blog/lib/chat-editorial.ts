import type { BlogArticle, BlogArticleSummary, BlogSitemapEntry } from "../types";

const SITE = "https://www.inxsocial.co.uk";

type ChatEditorialInput = Omit<
  BlogArticle,
  "id" | "editorial" | "jsonLd" | "faqJsonLd"
>;

/**
 * Independent ChatGPT editorial lane.
 *
 * Articles in this array are repository-owned website content. They do not use
 * the Growth Content Engine, Growth Autopilot article records, or backend AI
 * generation APIs. The scheduled ChatGPT SEO operator may add or update entries
 * here through the normal protected-branch PR/CI/deploy workflow.
 */
const rawChatEditorialArticles: ChatEditorialInput[] = [
  {
    slug: "social-media-hooks-cta-examples",
    title: "50 Social Media Hooks + CTA Examples for 2026",
    excerpt:
      "Copy-and-adapt social media hooks and call-to-action examples for Instagram, Reels, TikTok and LinkedIn, plus a simple way to pair the opening line with the right next step.",
    meta_description:
      "50 social media hooks and CTA examples for Instagram, Reels, TikTok and LinkedIn. Copy practical formulas for comments, saves, DMs, clicks and leads.",
    featured_image_url: null,
    keywords: [
      "social media hooks",
      "hook examples",
      "hooks for reels",
      "Instagram hooks",
      "TikTok hooks",
      "LinkedIn hooks",
      "social media CTA examples",
      "call to action examples",
      "Instagram CTA examples",
      "LinkedIn CTA examples"
    ],
    language: "en-GB",
    published_at: "2026-10-03T06:40:00Z",
    created_at: "2026-10-03T06:40:00Z",
    updated_at: "2026-10-03T06:40:00Z",
    quick_answer:
      "A strong social post usually does two separate jobs: the hook earns the next few seconds of attention, and the CTA gives the reader one clear next action. Make the hook specific, useful and relevant to the audience; then match the CTA to the post goal instead of ending every post with a generic request for engagement.",
    key_takeaways: [
      "Use one clear promise, problem, result or curiosity gap in the opening line.",
      "Match the CTA to the post goal: save, share, comment, DM, click or buy — not all of them at once.",
      "Short-form video benefits from an immediate hook, a useful body and a clear close.",
      "LinkedIn guidance explicitly recommends ending with a specific call to action that invites a focused response.",
      "Test multiple hook variations against the same core post before changing the whole idea."
    ],
    content_html: `
<p>People searching for <strong>social media hooks</strong>, <strong>hooks for Reels</strong> and <strong>social media CTA examples</strong> are usually not looking for another abstract copywriting lecture. They want lines they can adapt quickly, and they want to know which kind of line fits which goal.</p>
<p>This guide gives you both ends of the post: the opening that earns attention and the closing that tells the audience what to do next. The examples are written to be adapted rather than pasted word-for-word, because specificity to your niche is what makes a hook feel credible instead of generic.</p>

<h2>What is a social media hook?</h2>
<p>A hook is the first line, first spoken sentence, first text overlay or opening visual idea that gives someone a reason not to scroll. For short-form video, the opening matters especially quickly. TikTok's own creative guidance recommends a <strong>hook → body → close</strong> structure and says the value proposition should appear early, with a clear CTA at the end.</p>
<p>The useful rule is simple: <strong>do not try to explain everything in the hook</strong>. Make one promise, identify one pain point, reveal one surprising contrast, or open one curiosity gap. Then earn the next sentence.</p>

<h2>25 social media hook examples you can adapt</h2>
<h3>Problem and mistake hooks</h3>
<ol>
<li>You're making this harder than it needs to be.</li>
<li>If your posts are getting views but no action, check this first.</li>
<li>Most people fix the wrong part of their content.</li>
<li>This is why your good posts still get ignored.</li>
<li>Stop doing this before you publish your next Reel.</li>
</ol>

<h3>Specific result hooks</h3>
<ol start="6">
<li>Three small changes made this post much easier to act on.</li>
<li>Here's the 10-minute workflow I use before scheduling a week of content.</li>
<li>This one rewrite can make a weak caption feel much clearer.</li>
<li>Five content ideas you can turn into posts today.</li>
<li>One post, three platforms, three different openings — here's why.</li>
</ol>

<h3>Curiosity and contrast hooks</h3>
<ol start="11">
<li>The best part of this strategy is not the part everyone copies.</li>
<li>I thought I needed more content. I actually needed a better first line.</li>
<li>This looks like a small caption change, but it changes the whole post.</li>
<li>The post was fine. The opening was the problem.</li>
<li>What works on LinkedIn can feel completely wrong on Reels.</li>
</ol>

<h3>How-to and tutorial hooks</h3>
<ol start="16">
<li>Here's how to write a stronger hook in under two minutes.</li>
<li>Use this three-part structure when you do not know how to start the post.</li>
<li>Turn one customer question into five useful social posts.</li>
<li>Here's how to make a CTA sound natural instead of salesy.</li>
<li>Save this framework for the next time your caption feels flat.</li>
</ol>

<h3>Audience-specific hooks</h3>
<ol start="21">
<li>If you run a small agency, this will save you a lot of repetitive work.</li>
<li>If you're posting for clients every day, stop rebuilding the workflow from scratch.</li>
<li>Creators: use this when people watch but never click.</li>
<li>For founders who hate writing social posts, start here.</li>
<li>If your team publishes across several platforms, this is the part worth standardising.</li>
</ol>

<h2>What makes a CTA work on social media?</h2>
<p>A call to action should make the next step obvious and proportionate to the audience's level of intent. Someone who just discovered you may be happy to save a useful post; asking that same person to book a sales call immediately may be too much.</p>
<p>LinkedIn's own publishing guidance recommends ending a post with a <strong>specific</strong> CTA — for example, asking a focused question, requesting examples, inviting a perspective or encouraging readers to share the post with someone who would benefit. The important word is specific.</p>

<h2>25 social media CTA examples by goal</h2>
<h3>CTAs for comments</h3>
<ol>
<li>Which part of this is hardest in your workflow?</li>
<li>What would you add to this list?</li>
<li>Which option would you test first?</li>
<li>What are you doing differently right now?</li>
<li>Tell me the platform you struggle with most.</li>
</ol>

<h3>CTAs for saves and shares</h3>
<ol start="6">
<li>Save this for your next content-planning session.</li>
<li>Keep this list nearby when you write your next caption.</li>
<li>Send this to the person who writes your social copy.</li>
<li>Share this with a teammate who always gets stuck on the first line.</li>
<li>Bookmark this before you build next week's posts.</li>
</ol>

<h3>CTAs for DMs and conversations</h3>
<ol start="11">
<li>DM me the word PLAN if you want the checklist.</li>
<li>Send me your current hook and I'll tell you what I would tighten.</li>
<li>Message me with your niche and I'll suggest three angles to test.</li>
<li>DM me if you want the template behind this workflow.</li>
<li>Send this post back to me with the part you want explained.</li>
</ol>

<h3>CTAs for clicks and traffic</h3>
<ol start="16">
<li>See the full workflow at the link in bio.</li>
<li>Open the guide if you want the step-by-step version.</li>
<li>Use the link to compare the full set of options.</li>
<li>Read the full breakdown before you build your next campaign.</li>
<li>Try the workflow yourself and compare it with your current setup.</li>
</ol>

<h3>CTAs for leads and conversions</h3>
<ol start="21">
<li>Start with the workflow that removes the most repetitive work from your week.</li>
<li>See how the full publishing process works before changing your current stack.</li>
<li>Build one campaign first, then decide whether the system fits your team.</li>
<li>Compare your current process with a single-workspace publishing flow.</li>
<li>If this is the bottleneck in your team, test the workflow on one week of content.</li>
</ol>

<h2>How to pair the hook with the CTA</h2>
<p>The hook and CTA should feel like they belong to the same post. A strong opening creates an expectation; the body delivers on it; the CTA should be the natural next action.</p>
<ul>
<li><strong>Educational post:</strong> Hook with a clear problem or promise → teach the method → CTA to save or share.</li>
<li><strong>Opinion post:</strong> Hook with a specific point of view → explain the reasoning → CTA with a focused question.</li>
<li><strong>Lead-generation post:</strong> Hook with the audience's pain → demonstrate the solution → CTA to DM, click or test the workflow.</li>
<li><strong>Short-form demo:</strong> Hook with the result → show the process → CTA to try, compare or learn more.</li>
</ul>

<h2>12 ready-made hook + CTA pairs</h2>
<p><strong>1. Educational Reel</strong><br>Hook: “Stop writing your caption from the first sentence.”<br>CTA: “Save this and use the structure on your next post.”</p>
<p><strong>2. Creator tip</strong><br>Hook: “If people watch but never click, the problem may be your last line.”<br>CTA: “Which CTA are you using most right now?”</p>
<p><strong>3. Agency workflow</strong><br>Hook: “If your team still copies the same post into four tabs, fix this first.”<br>CTA: “Send this to the person managing your publishing workflow.”</p>
<p><strong>4. LinkedIn opinion</strong><br>Hook: “More posts will not fix unclear positioning.”<br>CTA: “What would you change first: message, format or frequency?”</p>
<p><strong>5. Product demo</strong><br>Hook: “Here is what a week of content looks like when the repetitive steps are removed.”<br>CTA: “See the full workflow and compare it with your current process.”</p>
<p><strong>6. Carousel</strong><br>Hook: “Seven opening lines to use when your post feels boring.”<br>CTA: “Save the carousel before you write tomorrow's post.”</p>
<p><strong>7. Mistake post</strong><br>Hook: “This CTA asks the audience to do too much.”<br>CTA: “Look at your last five posts: how many actions did each one ask for?”</p>
<p><strong>8. Behind-the-scenes</strong><br>Hook: “This is the part of our content workflow nobody sees.”<br>CTA: “Want the full checklist? Send me the word WORKFLOW.”</p>
<p><strong>9. Comparison post</strong><br>Hook: “The same opening should not be copied blindly across every platform.”<br>CTA: “Which platform should I break down next?”</p>
<p><strong>10. Founder post</strong><br>Hook: “I would rather publish three clear posts than ten forgettable ones.”<br>CTA: “Do you optimise for volume or clarity?”</p>
<p><strong>11. Tutorial</strong><br>Hook: “Use this when you know the topic but cannot find the first sentence.”<br>CTA: “Bookmark the formula and test three versions before publishing.”</p>
<p><strong>12. Lead magnet</strong><br>Hook: “I turned our most repeated content tasks into one checklist.”<br>CTA: “DM CHECKLIST and I'll send you the outline.”</p>

<h2>Platform notes: Reels, TikTok and LinkedIn</h2>
<h3>Reels and other short-form video</h3>
<p>Lead with the value quickly. Your spoken opener, first visual and text overlay should support the same idea instead of competing with each other. Avoid a long greeting before the useful part. A clear result, mistake, problem or curiosity gap gives the viewer a reason to stay.</p>

<h3>TikTok</h3>
<p>TikTok's official creative guidance explicitly recommends a hook, body and close. It also recommends landing the proposition early and ending with a clear CTA. That makes the platform a good place to think in complete mini-arcs rather than isolated “viral hooks”.</p>

<h3>LinkedIn</h3>
<p>On LinkedIn, the opening line has to earn the rest of the text, but the close matters just as much. LinkedIn recommends a specific CTA rather than a vague ending, including focused questions, requests for examples and invitations to share a useful post.</p>

<h2>Test hooks and CTAs instead of guessing</h2>
<p>Do not rewrite the entire post every time performance is weak. Keep the core idea stable and test the elements around it. For example, publish variations of the same idea with a problem hook, a specific-result hook and a contrarian hook. Then compare which opening produces better watch time, comments, saves, clicks or qualified conversations.</p>
<p>Do the same with the CTA. A post designed for reach may perform better with a save/share action, while a warmer audience may respond better to a DM or click. The goal is not to find one “best CTA”. It is to match the ask to the post and the audience.</p>

<h2>A simple hook-to-CTA writing formula</h2>
<p>When you are stuck, use this five-step sequence:</p>
<ol>
<li><strong>Audience:</strong> Who is this specifically for?</li>
<li><strong>Hook:</strong> What problem, result, contrast or curiosity earns attention?</li>
<li><strong>Value:</strong> What useful thing does the post actually deliver?</li>
<li><strong>Proof or example:</strong> What makes the advice believable and concrete?</li>
<li><strong>CTA:</strong> What is the one next action that fits the post?</li>
</ol>
<p>That is enough structure for a short caption, a LinkedIn post, a carousel, or a short-form video script without making the copy feel mechanical.</p>
`,
    editorial_promo: {
      title: "Turn strong hooks into a repeatable publishing workflow",
      description:
        "INXSocial brings content creation, scheduling and multi-platform publishing into one workspace so you can test ideas without rebuilding the process every time.",
      label: "Explore INXSocial",
      url: "/",
      before_heading: "Test hooks and CTAs instead of guessing"
    },
    sources: [
      {
        id: "S1",
        title: "Creative Codes: 6 principles for creating on TikTok",
        url: "https://ads.tiktok.com/business/en/blog/creative-best-practices-top-performing-ads?redirected=1",
        domain: "ads.tiktok.com"
      },
      {
        id: "S2",
        title: "Creative best practices for performance ads",
        url: "https://ads.tiktok.com/resources/help/article/creative-best-practices?lang=en&q=ACO&redirected=2",
        domain: "ads.tiktok.com"
      },
      {
        id: "S3",
        title: "How to Write an Engaging Post in Your LinkedIn Feed",
        url: "https://www.linkedin.com/business/talent/blog/talent-acquisition/how-to-write-engaging-post-in-linkedin-feed",
        domain: "linkedin.com"
      },
      {
        id: "S4",
        title: "50 hook examples that stop the scroll",
        url: "https://colorkuler.com/blog/50-hook-examples-that-stop-the-scroll-instagram-tiktok-linkedin",
        domain: "colorkuler.com"
      },
      {
        id: "S5",
        title: "40 Social Media CTA Examples That Do Not Sound Desperate",
        url: "https://www.creobee.com/blog/social-media-cta-examples",
        domain: "creobee.com"
      }
    ],
    internalLinks: [
      {
        label: "Explore INXSocial",
        url: "/",
        description: "Create, schedule and publish social content from one workspace."
      },
      {
        label: "More social media guides",
        url: "/blog",
        description: "Browse practical INXSocial guides for planning, publishing and growth."
      }
    ],
    faq: [
      {
        question: "What is a hook in social media?",
        answer:
          "A social media hook is the opening line, visual, spoken sentence or text overlay designed to give the right audience a reason to keep watching or reading."
      },
      {
        question: "What is a CTA in social media?",
        answer:
          "A CTA, or call to action, tells the audience what to do next. Common social CTAs include saving, sharing, commenting, sending a DM, clicking a link or starting a purchase or trial."
      },
      {
        question: "What are good hooks for Reels?",
        answer:
          "Good Reel hooks are specific and immediate. Useful patterns include a clear result, a common mistake, a direct question, a surprising contrast, a problem statement or a short how-to promise."
      },
      {
        question: "Should every social media post have a CTA?",
        answer:
          "Not every post needs a promotional CTA, but most posts benefit from a clear ending. The right action may simply be to save, share, answer a focused question or continue to a relevant resource."
      },
      {
        question: "How many CTAs should I use in one social post?",
        answer:
          "Usually one primary CTA is clearer than several competing asks. Match that action to the goal of the post and the audience's level of intent."
      }
    ]
  }
];

function iso(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toArticle(input: ChatEditorialInput): BlogArticle {
  const published = iso(input.published_at || input.created_at);
  const updated = iso(input.updated_at || input.published_at || input.created_at);
  const canonical = `${SITE}/blog/${input.slug}`;
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const faq = Array.isArray(input.faq) ? input.faq : [];

  return {
    ...input,
    id: `chatgpt:${input.slug}`,
    editorial: {
      method: "ChatGPT repository editorial",
      sourceCount: sources.length,
      updatedAt: updated || null,
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: input.title,
      description: input.meta_description || input.excerpt || undefined,
      datePublished: published,
      dateModified: updated || published,
      mainEntityOfPage: canonical,
      url: canonical,
      author: {
        "@type": "Organization",
        name: "INXSocial Editorial",
        url: SITE,
      },
      publisher: {
        "@type": "Organization",
        name: "INXSocial",
        url: SITE,
      },
      image: input.featured_image_url || undefined,
    },
    faqJsonLd: faq.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null,
  };
}

function articleTime(article: BlogArticleSummary) {
  const value = article.published_at || article.updated_at || article.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export const chatEditorialArticles: BlogArticle[] = rawChatEditorialArticles
  .map(toArticle)
  .sort((a, b) => articleTime(b) - articleTime(a));

export function getChatEditorialArticleBySlug(slug: string): BlogArticle | null {
  return chatEditorialArticles.find((article) => article.slug === slug) || null;
}

export function getChatEditorialArticles(): BlogArticleSummary[] {
  return chatEditorialArticles;
}

export function getChatEditorialArticlesByTag(tag: string): BlogArticleSummary[] {
  const normalized = String(tag || "").trim().toLowerCase();
  return chatEditorialArticles.filter((article) =>
    (article.keywords || []).some((keyword) => {
      const slug = String(keyword || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90);
      return slug === normalized;
    }),
  );
}

export function getChatEditorialSitemapEntries(): BlogSitemapEntry[] {
  return chatEditorialArticles.map((article) => ({
    slug: article.slug,
    published_at: article.published_at || null,
    created_at: article.created_at || null,
    updated_at: article.updated_at || null,
  }));
}

export function mergeBlogArticles(
  remote: BlogArticleSummary[],
  local: BlogArticleSummary[],
): BlogArticleSummary[] {
  const bySlug = new Map<string, BlogArticleSummary>();
  for (const article of remote || []) {
    if (article?.slug) bySlug.set(article.slug, article);
  }
  for (const article of local || []) {
    if (article?.slug) bySlug.set(article.slug, article);
  }
  return [...bySlug.values()].sort((a, b) => articleTime(b) - articleTime(a));
}

export function mergeBlogSitemapEntries(
  remote: BlogSitemapEntry[],
  local: BlogSitemapEntry[],
): BlogSitemapEntry[] {
  const bySlug = new Map<string, BlogSitemapEntry>();
  for (const entry of remote || []) {
    if (entry?.slug) bySlug.set(entry.slug, entry);
  }
  for (const entry of local || []) {
    if (entry?.slug) bySlug.set(entry.slug, entry);
  }
  return [...bySlug.values()];
}
