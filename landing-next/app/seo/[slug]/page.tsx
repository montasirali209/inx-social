import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeoPage, seoPageSlugs } from "@/lib/seo-pages";
import styles from "./seo-page.module.css";

const SITE = "https://www.inxsocial.co.uk";

const INTRO_HEADINGS: Record<string, string> = {
  "social-media-scheduler": "A social media scheduler should connect planning, publishing and review.",
  "bulk-social-media-scheduler": "Bulk scheduling should remove repetitive publishing work, not hide it.",
  "social-media-content-calendar": "A content calendar works best when it reflects the real publishing queue.",
  "social-media-analytics": "Social analytics are more useful when they sit next to the publishing workflow.",
  "ai-social-media-tools": "AI social media tools should shorten the path from idea to published content.",
  "ai-social-media-campaign-generator": "A campaign generator should preserve strategy, brand context and the path into scheduling.",
  "ai-social-media-post-generator": "AI post generation is more valuable when the result is already publishing-ready.",
  "ai-carousel-post-generator": "Strong carousel creation starts with sequence, not isolated slides.",
  "ai-video-post-generator": "Short-form video production should stay connected to the social workflow.",
  "ai-ugc-ad-generator": "UGC-style creative needs a social-first workflow around the product story.",
  pricing: "Compare INXSocial plans by connected accounts, AI credits and operating scale."
};

const HERO_IMAGE_ALTS: Record<string, string> = {
  "social-media-scheduler": "INXSocial social media scheduler dashboard with publishing activity, scheduled content and connected accounts",
  "bulk-social-media-scheduler": "INXSocial dashboard supporting bulk social media scheduling and publishing workflows",
  "social-media-content-calendar": "INXSocial social media planning workspace with scheduling and content activity",
  "social-media-analytics": "INXSocial social media analytics dashboard showing publishing activity, engagement and platform distribution",
  "ai-social-media-tools": "INXSocial AI Content Studio showing Image Post, Carousel Post, Short Video / Reel, UGC Ad Studio and AI Post Campaign workflows",
  "ai-social-media-campaign-generator": "INXSocial AI Content Studio showing the AI Post Campaign workflow alongside image, carousel, video and UGC creation tools",
  "ai-social-media-post-generator": "INXSocial AI Content Studio showing social post creation workflows for image, carousel, video, UGC and campaigns",
  "ai-carousel-post-generator": "INXSocial AI Content Studio showing Carousel Post alongside image, video, UGC and campaign creation workflows",
  "ai-video-post-generator": "INXSocial AI Content Studio showing Short Video / Reel alongside image, carousel, UGC and campaign creation workflows",
  "ai-ugc-ad-generator": "INXSocial AI Content Studio showing UGC Ad Studio alongside image, carousel, video and campaign creation workflows",
  pricing: "INXSocial dashboard included across social media management plans"
};

const AI_CONTENT_STUDIO_SLUGS = new Set([
  "ai-social-media-tools",
  "ai-social-media-campaign-generator",
  "ai-social-media-post-generator",
  "ai-carousel-post-generator",
  "ai-video-post-generator",
  "ai-ugc-ad-generator"
]);

function getHeroImage(slug: string) {
  if (AI_CONTENT_STUDIO_SLUGS.has(slug)) {
    return {
      src: "/assets/ai-content-studio-seo.webp",
      width: 700,
      height: 493,
      label: "Actual AI Content Studio workspace"
    };
  }

  return {
    src: "/assets/landing-dashboard-20260919.webp",
    width: 1200,
    height: 675,
    label: "Actual INXSocial workspace"
  };
}

export function generateStaticParams() {
  return seoPageSlugs.map(slug => ({ slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page) return {};

  const canonical = `${SITE}/${page.slug}`;
  const heroImage = getHeroImage(page.slug);

  return {
    title: page.title,
    description: page.metaDescription,
    authors: [{ name: "INAXX LTD" }],
    category: "software",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    },
    alternates: {
      canonical,
      languages: {
        "en-GB": canonical,
        "x-default": canonical
      }
    },
    openGraph: {
      type: "website",
      locale: "en_GB",
      siteName: "INXSocial",
      title: page.title,
      description: page.metaDescription,
      url: canonical,
      images: [
        {
          url: heroImage.src,
          width: heroImage.width,
          height: heroImage.height,
          alt: HERO_IMAGE_ALTS[page.slug] ?? "INXSocial social media management dashboard"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.metaDescription,
      images: [heroImage.src]
    }
  };
}

function buildSchema(slug: string) {
  const page = getSeoPage(slug);
  if (!page) return null;

  const url = `${SITE}/${page.slug}`;
  const heroImage = getHeroImage(page.slug);
  const image = `${SITE}${heroImage.src}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://inaxx.co.uk/#organization",
        name: "INAXX LTD",
        url: "https://inaxx.co.uk/"
      },
      {
        "@type": "Brand",
        "@id": `${SITE}/#brand`,
        name: "INXSocial",
        url: `${SITE}/`,
        logo: `${SITE}/assets/inx-social-logo.png`
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: `${SITE}/`,
        name: "INXSocial",
        inLanguage: "en-GB",
        publisher: { "@id": "https://inaxx.co.uk/#organization" }
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": `${SITE}/#software`,
        name: "INXSocial",
        url: `${SITE}/`,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Social Media Management",
        operatingSystem: "Web browser",
        description: "Social media management software for content creation, scheduling, bulk publishing, content calendars, analytics and AI-assisted social content production.",
        brand: { "@id": `${SITE}/#brand` },
        publisher: { "@id": "https://inaxx.co.uk/#organization" },
        offers: [
          { "@type": "Offer", name: "Trial", price: "0", priceCurrency: "GBP", url: `${SITE}/pricing` },
          { "@type": "Offer", name: "Creator", price: "18.99", priceCurrency: "GBP", url: `${SITE}/pricing` },
          { "@type": "Offer", name: "Pro", price: "34.99", priceCurrency: "GBP", url: `${SITE}/pricing` },
          { "@type": "Offer", name: "Business", price: "59.99", priceCurrency: "GBP", url: `${SITE}/pricing` },
          { "@type": "Offer", name: "Agency", price: "99.99", priceCurrency: "GBP", url: `${SITE}/pricing` }
        ]
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: page.title,
        description: page.metaDescription,
        inLanguage: "en-GB",
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": `${SITE}/#software` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          contentUrl: image,
          url: image,
          width: heroImage.width,
          height: heroImage.height
        },
        breadcrumb: { "@id": `${url}#breadcrumb` }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "INXSocial",
            item: `${SITE}/`
          },
          {
            "@type": "ListItem",
            position: 2,
            name: page.eyebrow,
            item: url
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: page.faq.map(item => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer
          }
        }))
      }
    ]
  };
}

export default async function SeoMarketingPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page) notFound();

  const schema = buildSchema(slug);
  const heroImage = getHeroImage(page.slug);

  return (
    <div className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <header className={styles.header}>
        <div className={styles.shell}>
          <Link className={styles.brand} href="/" aria-label="INXSocial home">
            <img src="/assets/inx-social-wordmark-small.webp" alt="INXSocial" width="166" height="42" />
          </Link>
          <nav className={styles.nav} aria-label="Marketing navigation">
            <Link href="/social-media-scheduler">Scheduler</Link>
            <Link href="/bulk-social-media-scheduler">Bulk Scheduler</Link>
            <Link href="/ai-social-media-tools">AI Studio</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
          <div className={styles.headerActions}>
            <a className={styles.signIn} href="/portal/login.html?return=/app/">Sign in</a>
            <a className={styles.primaryButton} href="/portal/register.html">Start free trial</a>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={`${styles.shell} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                <Link href="/">INXSocial</Link>
                <span aria-hidden="true">/</span>
                <span>{page.eyebrow}</span>
              </nav>
              <span className={styles.eyebrow}>{page.eyebrow}</span>
              <h1>{page.h1}</h1>
              <p className={styles.lead}>{page.lead}</p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButtonLarge} href="/portal/register.html">
                  Start free trial <span aria-hidden="true">→</span>
                </a>
                <Link className={styles.secondaryButton} href="/pricing">View pricing</Link>
              </div>
              <div className={styles.proof}>
                <span>✓ 7-day trial</span>
                <span>✓ 9 supported platforms</span>
                <span>✓ No card required</span>
              </div>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.visualLabel}>{heroImage.label}</div>
              <img
                src={heroImage.src}
                width={heroImage.width}
                height={heroImage.height}
                alt={HERO_IMAGE_ALTS[page.slug] ?? "INXSocial social media management dashboard"}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section className={styles.introSection}>
          <div className={`${styles.shell} ${styles.introGrid}`}>
            <div>
              <span className={styles.kicker}>Why it matters</span>
              <h2>{INTRO_HEADINGS[page.slug] ?? page.h1}</h2>
            </div>
            <div className={styles.longCopy}>
              {page.intro.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </div>
        </section>

        <section className={styles.featuresSection}>
          <div className={styles.shell}>
            <span className={styles.kicker}>Inside the workflow</span>
            <h2 className={styles.sectionTitle}>Built around the work you actually need to finish.</h2>
            <div className={styles.featureGrid}>
              {page.highlights.map((item, index) => (
                <article className={styles.featureCard} key={item.title}>
                  <span className={styles.featureNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.workflowSection}>
          <div className={styles.shell}>
            <span className={styles.kicker}>How it works</span>
            <h2 className={styles.sectionTitle}>{page.workflowHeading}</h2>
            <div className={styles.workflowGrid}>
              {page.workflow.map((item, index) => (
                <article className={styles.workflowCard} key={item.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.detailSection}>
          <div className={`${styles.shell} ${styles.detailGrid}`}>
            <div>
              <span className={styles.kicker}>INXSocial context</span>
              <h2>{page.detailHeading}</h2>
            </div>
            <div className={styles.longCopy}>
              {page.details.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </div>
        </section>

        <section className={styles.platformSection}>
          <div className={styles.shell}>
            <span className={styles.kicker}>Connected platforms</span>
            <h2 className={styles.sectionTitle}>One workspace across the networks that matter.</h2>
            <p className={styles.platformNote}>
              Facebook, Instagram, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky and X are represented in the connected-account experience. Publishing and analytics capabilities vary by network permissions and account type.
            </p>
            <div className={styles.platformList} aria-label="Supported social platforms">
              {["Facebook","Instagram","LinkedIn","TikTok","YouTube","Pinterest","Threads","Bluesky","X / Twitter"].map(platform => (
                <span key={platform}>{platform}</span>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={`${styles.shell} ${styles.faqGrid}`}>
            <div>
              <span className={styles.kicker}>FAQ</span>
              <h2>Questions people ask before choosing a social media tool.</h2>
            </div>
            <div className={styles.faqList}>
              {page.faq.map(item => (
                <details key={item.question}>
                  <summary>{item.question}<span aria-hidden="true">+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.relatedSection}>
          <div className={styles.shell}>
            <span className={styles.kicker}>Explore INXSocial</span>
            <h2 className={styles.sectionTitle}>Related product workflows</h2>
            <div className={styles.relatedGrid}>
              {page.related.map(relatedSlug => {
                const related = getSeoPage(relatedSlug);
                if (!related) return null;
                return (
                  <Link className={styles.relatedCard} href={`/${related.slug}`} key={related.slug}>
                    <span>{related.eyebrow}</span>
                    <strong>{related.h1}</strong>
                    <small>Learn more →</small>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className={`${styles.shell} ${styles.ctaCard}`}>
            <div>
              <span className={styles.eyebrow}>Ready to run the workflow?</span>
              <h2>Create, schedule, analyse and grow from one workspace.</h2>
              <p>Start with the trial, connect the accounts you use and build your next publishing cycle in INXSocial.</p>
            </div>
            <div className={styles.ctaActions}>
              <a className={styles.primaryButtonLarge} href="/portal/register.html">Start free trial →</a>
              <a className={styles.darkButton} href="/portal/login.html?return=/app/">Open INXSocial</a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerGrid}`}>
          <div>
            <img src="/assets/inx-social-wordmark-small.webp" alt="INXSocial" width="166" height="42" />
            <p>Create. Schedule. Analyse. Grow.</p>
          </div>
          <div>
            <strong>Product</strong>
            <Link href="/social-media-scheduler">Social media scheduler</Link>
            <Link href="/bulk-social-media-scheduler">Bulk scheduler</Link>
            <Link href="/social-media-content-calendar">Content calendar</Link>
            <Link href="/social-media-analytics">Analytics</Link>
          </div>
          <div>
            <strong>AI Content Studio</strong>
            <Link href="/ai-social-media-tools">AI social media tools</Link>
            <Link href="/ai-social-media-post-generator">AI post generator</Link>
            <Link href="/ai-carousel-post-generator">AI carousel generator</Link>
            <Link href="/ai-video-post-generator">AI video generator</Link>
            <Link href="/ai-ugc-ad-generator">AI UGC ads</Link>
          </div>
          <div>
            <strong>Company</strong>
            <Link href="/pricing">Pricing</Link>
            <a href="https://inaxx.co.uk/">INAXX LTD</a>
            <a href="/privacy.html">Privacy</a>
            <a href="/terms.html">Terms</a>
          </div>
        </div>
        <div className={`${styles.shell} ${styles.footerBottom}`}>
          <span>© 2026 INAXX LTD. All rights reserved.</span>
          <Link href="/">INXSocial home</Link>
        </div>
      </footer>
    </div>
  );
}
