import type { CSSProperties } from 'react'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ImageIcon,
  Layers3,
  Link2,
  Play,
  Send,
  Sparkles,
  Video,
  WandSparkles,
  Waypoints,
} from 'lucide-react'
import type { AcquisitionPage as AcquisitionPageData } from '@/lib/acquisition'
import { site } from '@/lib/site'
import { ProductShot, productShots } from './product-shot'
import { Reveal } from './reveal'
import { TrackLink } from './track-link'

export function AcquisitionPage({ page }: { page: AcquisitionPageData }) {
  return (
    <>
      <StructuredPageSchema page={page} />

      <section className="section acquisition-hero">
        <div className="acquisition-hero-glow" aria-hidden="true" />
        <div className="container-shell acquisition-hero-grid">
          <Reveal className="acquisition-hero-copy">
            <div className="breadcrumbs" aria-label="Breadcrumb">
              <TrackLink href="/" eventName="acquisition_breadcrumb_click">Home</TrackLink>
              <span>/</span>
              <span>{page.platform ? `${page.platform} scheduler` : page.eyebrow}</span>
            </div>
            <span className="eyebrow">{page.eyebrow}</span>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
            <div className="hero-actions">
              <TrackLink className="button button-primary button-large" href={site.registerUrl} eventName="acquisition_trial_click" eventData={{ page: page.slug }}>
                Start free trial <ArrowRight aria-hidden="true" />
              </TrackLink>
              <TrackLink className="button button-secondary button-large" href={site.appUrl} eventName="acquisition_login_click" eventData={{ page: page.slug }}>
                Sign in
              </TrackLink>
            </div>
            <div className="acquisition-proof">
              {page.proof.map((item) => <span key={item}><Check aria-hidden="true" />{item}</span>)}
            </div>
          </Reveal>

          <Reveal className="acquisition-hero-visual" delay={80}>
            <AcquisitionVisual page={page} />
          </Reveal>
        </div>
      </section>

      <section className="section acquisition-sections">
        <div className="container-shell">
          {page.sections.map((section, index) => (
            <Reveal className={`acquisition-story ${index % 2 ? 'reverse' : ''}`} delay={index * 45} key={section.title}>
              <div className="acquisition-story-copy">
                <span className="story-number">0{index + 1}</span>
                <h2>{section.title}</h2>
                <p>{section.text}</p>
              </div>
              <div className="acquisition-point-card">
                {section.points.map((point) => (
                  <div key={point}><span><Check aria-hidden="true" /></span><strong>{point}</strong></div>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {page.platform && <PlatformNetworkBand page={page} />}

      <section className="section acquisition-faq">
        <div className="container-shell faq-grid">
          <Reveal className="faq-intro">
            <span className="eyebrow">Questions answered</span>
            <h2>What to know before you connect and schedule.</h2>
            <p>INXSocial keeps platform connections, publishing and plan limits explicit so the workflow remains predictable.</p>
          </Reveal>
          <Reveal className="faq-list" delay={60}>
            {page.faqs.map(([question, answer], index) => (
              <details className="faq-item" key={question} open={index === 0}>
                <summary>{question}<span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section related-section">
        <div className="container-shell">
          <Reveal className="section-heading centered compact-heading">
            <span className="eyebrow">Keep exploring</span>
            <h2>See how the rest of the INXSocial workflow connects.</h2>
          </Reveal>
          <div className="related-grid">
            {page.related.map((item, index) => (
              <Reveal className="related-card" delay={index * 45} key={item.href}>
                <TrackLink href={item.href} eventName="acquisition_related_click" eventData={{ from: page.slug, to: item.href }}>
                  <span>INXSocial</span>
                  <strong>{item.label}</strong>
                  <ArrowRight aria-hidden="true" />
                </TrackLink>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section acquisition-final">
        <div className="container-shell">
          <Reveal className="final-cta-card">
            <div className="final-cta-orb" aria-hidden="true" />
            <div>
              <span className="eyebrow eyebrow-light">Start with the real workflow</span>
              <h2>Try INXSocial for seven days.</h2>
              <p>Connect up to two accounts, publish up to 50 posts, use scheduling and Bulk Scheduler, access Full Analytics and start with 20 AI Content Studio credits.</p>
            </div>
            <div className="final-actions">
              <TrackLink className="button button-primary button-large" href={site.registerUrl} eventName="acquisition_final_trial_click" eventData={{ page: page.slug }}>
                Start free trial <ArrowRight aria-hidden="true" />
              </TrackLink>
              <TrackLink className="button button-secondary button-large" href="/pricing" eventName="acquisition_pricing_click" eventData={{ page: page.slug }}>
                Compare plans
              </TrackLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}

function StructuredPageSchema({ page }: { page: AcquisitionPageData }) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: page.title,
        description: page.description,
        url: `${site.url}/${page.slug}`,
        isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'INXSocial', item: site.url },
          { '@type': 'ListItem', position: 2, name: page.platform ? `${page.platform} scheduler` : page.eyebrow, item: `${site.url}/${page.slug}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: page.faqs.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

function AcquisitionVisual({ page }: { page: AcquisitionPageData }) {
  if (page.visual === 'ai') {
    return <ProductShot src={productShots.ai} alt="Real INXSocial AI Content Studio interface" label="AI Content Studio" caption="Actual product interface" className="acq-real-shot" />
  }

  if (page.visual === 'bulk') {
    return <ProductShot src={productShots.bulk} alt="Real INXSocial Bulk Scheduler interface" label="Bulk Scheduler" caption="Actual product interface" className="acq-real-shot" />
  }

  if (page.visual === 'analytics') {
    return <ProductShot src={productShots.analytics} alt="Real INXSocial Analytics interface" label="Full Analytics" caption="Actual product interface" className="acq-real-shot" />
  }

  if (page.visual === 'features') {
    return <ProductShot src={productShots.dashboard} alt="Real INXSocial dashboard interface" label="INXSocial Dashboard" caption="Actual product interface" className="acq-real-shot" />
  }

  if (page.visual === 'platform') {
    return (
      <div className="acq-visual-card platform-acq-visual">
        <div className="platform-acq-orb" style={{ '--network-tone': page.platformTone } as CSSProperties}>
          <span>{page.platformMark}</span>
        </div>
        <div className="platform-acq-flow">
          <div><span>Content</span><strong>Ready</strong></div>
          <i />
          <div><span>Schedule</span><strong>18:30</strong></div>
          <i />
          <div><span>Destination</span><strong>{page.platform}</strong></div>
        </div>
        <div className="platform-acq-status"><span><i /> Connected</span><b>One INXSocial workspace</b></div>
      </div>
    )
  }

  if (page.visual === 'accounts') {
    const accounts = [
      ['Facebook','f','#1877f2'],
      ['Instagram','◎','#e1306c'],
      ['LinkedIn','in','#0a66c2'],
      ['TikTok','♪','#25f4ee'],
    ]
    return (
      <div className="acq-visual-card accounts-acq-visual">
        <div className="acq-window-head"><Link2 /> Connected Accounts <span>Reusable destinations</span></div>
        <div className="accounts-acq-list">
          {accounts.map(([name, mark, tone]) => <div key={name}><span style={{ '--network-tone': tone } as CSSProperties}>{mark}</span><div><strong>{name}</strong><small>Connected destination</small></div><i /></div>)}
        </div>
        <div className="accounts-acq-summary"><strong>9 networks</strong><span>One destination workspace</span></div>
      </div>
    )
  }

  if (page.visual === 'scheduler') {
    return <ProductShot src={productShots.bulk} alt="Real INXSocial scheduling workflow" label="Scheduling workflow" caption="Bulk Scheduler product interface" className="acq-real-shot" />
  }

  return <ProductShot src={productShots.dashboard} alt="Real INXSocial product interface" label="INXSocial" caption="Actual product interface" className="acq-real-shot" />
}

function PlatformNetworkBand({ page }: { page: AcquisitionPageData }) {
  const networks = ['Facebook','Instagram','LinkedIn','TikTok','YouTube','Pinterest','Threads','Bluesky','X']
  return (
    <section className="section platform-network-band">
      <div className="container-shell">
        <Reveal className="section-heading centered compact-heading">
          <span className="eyebrow">Part of the wider mix</span>
          <h2>{page.platform} sits beside the rest of your connected networks.</h2>
          <p>Use the destinations relevant to your workspace without rebuilding the publishing process for every network.</p>
        </Reveal>
        <Reveal className="network-name-grid" delay={60}>
          {networks.map((network) => <span className={network === page.platform ? 'active' : ''} key={network}>{network}</span>)}
        </Reveal>
      </div>
    </section>
  )
}
