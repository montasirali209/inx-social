import type { Metadata } from "next";
import Link from "next/link";
import { countLabel, getVideoModelShowcase, modeLabel } from "@/lib/video-model-showcase";
import { WEBSITE_MEDIA, websiteMediaPath } from "@/lib/website-media";
import styles from "./page.module.css";

const SITE = "https://www.inxsocial.co.uk";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "AI Video Models & Multi-Model AI Video Studio | INXSocial",
  description: "Explore the live INXSocial AI Video Studio catalogue with generation-ready text-to-video, image-to-video, reference and audio-capable AI video models in one workspace.",
  alternates: { canonical: `${SITE}/ai-video-models` },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: {
    type: "website",
    siteName: "INXSocial",
    title: "AI Video Models & Multi-Model AI Video Studio | INXSocial",
    description: "Browse generation-ready AI video models available in INXSocial, then create and publish from one connected workflow.",
    url: `${SITE}/ai-video-models`,
    images: [{ url: websiteMediaPath(WEBSITE_MEDIA.seoAiVideoHero), width: 1400, height: 986, alt: "INXSocial AI Video Studio and AI Content Studio" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Video Models & Multi-Model AI Video Studio | INXSocial",
    description: "Explore generation-ready AI video models available in one INXSocial Video Studio.",
    images: [websiteMediaPath(WEBSITE_MEDIA.seoAiVideoHero)]
  }
};

function releaseLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default async function VideoModelsPage() {
  const showcase = await getVideoModelShowcase(100);
  const availableLabel = countLabel(showcase.generationReady);

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": `${SITE}/#software`,
        name: "INXSocial",
        url: `${SITE}/`,
        applicationCategory: "MultimediaApplication",
        applicationSubCategory: "AI content creation and social publishing",
        operatingSystem: "Web browser",
        description: "AI content creation and social publishing platform with a multi-model AI Video Studio, AI campaigns, UGC creation, scheduling and analytics.",
        featureList: [
          `${availableLabel} generation-ready AI video models`,
          "AI Recommended video model selection",
          "Text-to-video",
          "Image-to-video",
          "Reference-driven video where supported",
          "Native audio where supported",
          "Model-specific duration, resolution, aspect ratio and FPS controls",
          "Media Library and social publishing handoff"
        ]
      },
      {
        "@type": "CollectionPage",
        "@id": `${SITE}/ai-video-models#webpage`,
        url: `${SITE}/ai-video-models`,
        name: "AI Video Models available in INXSocial",
        description: `Explore ${availableLabel} generation-ready AI video models available through the INXSocial AI Video Studio.`,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: showcase.generationReady,
          itemListElement: showcase.latest.slice(0, 30).map((model, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: model.creator ? `${model.name} by ${model.creator}` : model.name
          }))
        }
      }
    ]
  };

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className={styles.header}>
        <div className={styles.shell}>
          <Link className={styles.brand} href="/" aria-label="INXSocial home">
            <img src="/assets/inx-social-wordmark-small.webp" alt="INXSocial" width="166" height="42" />
          </Link>
          <nav className={styles.nav}>
            <Link href="/ai-video-post-generator">AI Video Studio</Link>
            <Link href="/ai-social-media-tools">AI Content Studio</Link>
            <Link href="/social-media-scheduler">Scheduler</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
          <a className={styles.primaryButton} href="/portal/register.html">Start free trial</a>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={`${styles.shell} ${styles.heroGrid}`}>
            <div>
              <span className={styles.eyebrow}>Live AI video model catalogue</span>
              <h1>{availableLabel} generation-ready AI video models. One studio.</h1>
              <p>
                INXSocial brings multiple AI video providers and model families into one production workspace. Let AI Recommended choose a suitable model for your brief, or choose the model yourself and use the controls that model actually supports.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButtonLarge} href="/portal/register.html">Start creating →</a>
                <Link className={styles.secondaryButton} href="/ai-video-post-generator">Explore Video Studio</Link>
              </div>
              <div className={styles.proof}>
                <span>{showcase.generationReady} available now</span>
                <span>{showcase.catalogueTotal} tracked in the live catalogue</span>
                <span>Catalogue refreshes automatically</span>
              </div>
            </div>
            <div className={styles.statsPanel}>
              <div><strong>{showcase.generationReady}</strong><span>Generation ready</span></div>
              <div><strong>{showcase.modeCounts.textToVideo}</strong><span>Text-to-video</span></div>
              <div><strong>{showcase.modeCounts.imageToVideo}</strong><span>Image-to-video</span></div>
              <div><strong>{showcase.modeCounts.nativeAudio}</strong><span>Audio-capable</span></div>
            </div>
          </div>
        </section>

        <section className={styles.explain}>
          <div className={`${styles.shell} ${styles.explainGrid}`}>
            <div>
              <span className={styles.kicker}>Why a multi-model studio matters</span>
              <h2>Use the latest suitable model without rebuilding your workflow.</h2>
            </div>
            <div>
              <p>AI video models specialise in different things: speed, cinematic motion, reference consistency, audio, longer duration, resolution or cost efficiency. INXSocial keeps those differences behind one consistent Video Studio.</p>
              <p>The public catalogue below only showcases models that pass the current INXSocial generation-readiness checks. If a provider retires a model, pricing becomes unsafe or required configuration is unavailable, it can be removed from the ready catalogue automatically.</p>
            </div>
          </div>
        </section>

        <section className={styles.catalogue}>
          <div className={styles.shell}>
            <div className={styles.catalogueHeading}>
              <div>
                <span className={styles.kicker}>Available in INXSocial</span>
                <h2>Latest generation-ready AI video models</h2>
              </div>
              <p>Sorted by the release metadata available in the live catalogue. Capabilities vary by model.</p>
            </div>
            <div className={styles.modelGrid}>
              {showcase.latest.map((model, index) => {
                const release = releaseLabel(model.releasedAt);
                return (
                  <article className={styles.modelCard} key={`${model.creator || "model"}-${model.name}`}>
                    <div className={styles.modelTop}>
                      <span>{index < 3 ? "Latest" : "Available"}</span>
                      {release && <small>{release}</small>}
                    </div>
                    <h3>{model.name}</h3>
                    {model.creator && <strong>{model.creator}</strong>}
                    <p>{model.description || "Available through the INXSocial AI Video Studio."}</p>
                    <div className={styles.tags}>
                      {model.modes.slice(0, 4).map(mode => <span key={mode}>{modeLabel(mode)}</span>)}
                      {model.audioSupported && <span>Audio</span>}
                      {model.resolutions.slice(-2).map(resolution => <span key={resolution}>{resolution}</span>)}
                    </div>
                    <div className={styles.modelFoot}>
                      <span>{model.baselineCredits ? `From ~${model.baselineCredits} credits` : "Live pricing in studio"}</span>
                      <a href="/portal/login.html?return=/app/ai-content-studio">Try model →</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.workflow}>
          <div className={styles.shell}>
            <span className={styles.kickerLight}>One workflow</span>
            <h2>Choose a model—or let INXSocial choose for you.</h2>
            <div className={styles.workflowGrid}>
              <article><span>01</span><h3>Describe the video</h3><p>Start with the creative brief and add source or reference imagery when the selected mode supports it.</p></article>
              <article><span>02</span><h3>AI Recommended or Choose Model</h3><p>Use AI Recommended for quality-to-cost routing or browse the generation-ready catalogue yourself.</p></article>
              <article><span>03</span><h3>Generate, save and publish</h3><p>Use model-specific settings, monitor background generation, keep the result in Media Library and move it into Posts or scheduling.</p></article>
            </div>
          </div>
        </section>

        <section className={styles.cta}>
          <div className={`${styles.shell} ${styles.ctaCard}`}>
            <div>
              <span className={styles.eyebrow}>AI Video Studio + social publishing</span>
              <h2>Stop switching tools every time a new video model launches.</h2>
              <p>INXSocial keeps model discovery, generation, media management, scheduling and publishing in one connected product.</p>
            </div>
            <div className={styles.ctaActions}>
              <a className={styles.primaryButtonLarge} href="/portal/register.html">Start free trial →</a>
              <Link className={styles.secondaryButton} href="/pricing">View pricing</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.shell}>
          <div>
            <strong>AI creation</strong>
            <Link href="/ai-video-post-generator">AI Video Studio</Link>
            <Link href="/ai-video-models">AI video models</Link>
            <Link href="/ai-social-media-tools">AI Content Studio</Link>
            <Link href="/ai-ugc-ad-generator">UGC Ad Studio</Link>
          </div>
          <div>
            <strong>Publishing</strong>
            <Link href="/social-media-scheduler">Scheduler</Link>
            <Link href="/bulk-social-media-scheduler">Bulk Scheduler</Link>
            <Link href="/social-media-analytics">Analytics</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <div className={styles.footerBrand}>
            <img src="/assets/inx-social-wordmark-small.webp" alt="INXSocial" width="166" height="42" />
            <p>AI creation and social publishing in one workspace.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
