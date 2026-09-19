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

  if (page.visual === 'ai') {
    return (
      <div className="acq-visual-card ai-acq-visual">
        <div className="acq-window-head"><Sparkles /> AI Content Studio <span>Credit estimate before generation</span></div>
        <div className="ai-acq-grid">
          <div className="ai-acq-tile"><ImageIcon /><span>Image Post</span><i /></div>
          <div className="ai-acq-tile"><Layers3 /><span>Carousel</span><i /></div>
          <div className="ai-acq-tile ai-acq-featured"><Video /><span>Short Video</span><div><Play /></div></div>
          <div className="ai-acq-tile"><WandSparkles /><span>UGC Ad</span><i /></div>
        </div>
        <div className="acq-wallet"><span>Shared AI wallet</span><strong>500 credits</strong><small>Example Pro monthly allowance</small></div>
      </div>
    )
  }

  if (page.visual === 'bulk') {
    return (
      <div className="acq-visual-card bulk-acq-visual">
        <div className="acq-window-head"><CalendarDays /> Build Schedule <span>Campaign workspace</span></div>
        <div className="bulk-acq-body">
          <div className="bulk-acq-queue">
            {['Launch teaser','Carousel story','Product reel','Customer proof'].map((item, index) => (
              <div key={item}><i className={`bulk-acq-thumb b${index+1}`} /><span><strong>{item}</strong><small>{index + 2} destinations</small></span><Check /></div>
            ))}
          </div>
          <div className="bulk-acq-slots">
            {['11:00','15:15','19:30','22:15'].map((slot, index) => <div key={slot}><span>{slot}</span><strong>{['Mon','Tue','Wed','Thu'][index]}</strong><i /></div>)}
          </div>
        </div>
      </div>
    )
  }

  if (page.visual === 'analytics') {
    return (
      <div className="acq-visual-card analytics-acq-visual">
        <div className="acq-window-head"><BarChart3 /> Full Analytics <span>Connected account context</span></div>
        <div className="analytics-acq-kpis"><div><span>Published</span><strong>84</strong></div><div><span>Engagement</span><strong>12.8k</strong></div><div><span>Reach</span><strong>96.4k</strong></div></div>
        <div className="analytics-acq-chart"><i /><i /><i /><i /><svg viewBox="0 0 600 180" role="presentation"><path d="M0 150 C60 148 72 110 125 116 S208 150 255 100 S339 55 390 82 S485 38 600 26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg></div>
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
    return (
      <div className="acq-visual-card scheduler-acq-visual">
        <div className="acq-window-head"><Send /> Social Scheduler <span>9 supported networks</span></div>
        <div className="scheduler-acq-calendar">
          {['Mon','Tue','Wed','Thu','Fri'].map((day, index) => <div key={day}><span>{day}</span>{index !== 2 && <i className={`sched-post p${index+1}`} />}{index === 1 && <i className="sched-post p5" />}</div>)}
        </div>
        <div className="scheduler-acq-footer"><span>Publish now</span><span>Schedule later</span><span>Bulk Scheduler</span></div>
      </div>
    )
  }

  return (
    <div className="acq-visual-card features-acq-visual">
      <div className="acq-window-head"><Waypoints /> INXSocial workspace <span>Connected workflow</span></div>
      <div className="features-acq-grid">
        <div><Send /><span>Posts</span></div>
        <div><Layers3 /><span>Bulk Scheduler</span></div>
        <div><CalendarDays /><span>Calendar</span></div>
        <div><Sparkles /><span>AI Studio</span></div>
        <div><BarChart3 /><span>Analytics</span></div>
        <div><Link2 /><span>Accounts</span></div>
      </div>
    </div>
  )
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
