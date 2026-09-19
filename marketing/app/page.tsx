import type { Metadata } from 'next'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Layers3,
  Link2,
  Send,
  Sparkles,
  Video,
  WandSparkles,
} from 'lucide-react'
import { FAQSchema } from '@/components/faq-schema'
import { ProductShot, productShots } from '@/components/product-shot'
import { Reveal } from '@/components/reveal'
import { TrackLink } from '@/components/track-link'
import { faqs, plans, platforms } from '@/lib/product'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Social media scheduling, analytics and AI content',
  description: 'Create, schedule, publish and analyse social content across nine networks with Bulk Scheduler, AI Content Studio and one connected INXSocial workspace.',
  alternates: { canonical: '/' },
}

const pillars = [
  {
    index: '01',
    title: 'Dashboard',
    copy: 'See publishing activity, engagement, recent posts, upcoming schedule and connected-account coverage from one overview.',
    href: '/features',
    image: productShots.dashboard,
    alt: 'Real INXSocial dashboard interface',
  },
  {
    index: '02',
    title: 'Bulk Scheduler',
    copy: 'Upload media in batches, select destinations, add captions and timing, then publish or schedule the full batch from one session.',
    href: '/bulk-scheduler',
    image: productShots.bulk,
    alt: 'Real INXSocial Bulk Scheduler interface',
  },
  {
    index: '03',
    title: 'Analytics',
    copy: 'Use verified connected-account data to review performance, engagement, content views, reach and publishing trends.',
    href: '/analytics',
    image: productShots.analytics,
    alt: 'Real INXSocial Analytics interface',
  },
  {
    index: '04',
    title: 'AI Content Studio',
    copy: 'Generate images, carousels, short video and UGC-style creative, then send finished content directly into Posts.',
    href: '/ai-content-studio',
    image: productShots.ai,
    alt: 'Real INXSocial AI Content Studio interface',
  },
]

const paidPlans = plans.filter((plan) => plan.id !== 'trial')

function planHref(id: string) {
  return id === 'trial' ? site.registerUrl : `${site.registerUrl}?plan=${id.toUpperCase()}`
}

export default function HomePage() {
  return (
    <>
      <FAQSchema />

      <section className="phase4-hero">
        <div className="phase4-hero-grid" aria-hidden="true" />
        <div className="phase4-hero-glow" aria-hidden="true" />
        <div className="container-shell phase4-hero-inner">
          <Reveal className="phase4-hero-copy">
            <span className="phase4-kicker">All-in-one social media management</span>
            <h1>Create. Schedule.<br />Grow. <span>All in one place.</span></h1>
            <p>INXSocial helps creators, brands and agencies plan, publish, analyse and grow across connected social platforms — with AI built directly into the workflow.</p>
            <div className="hero-actions">
              <TrackLink className="button button-primary button-large phase4-primary" href={site.registerUrl} eventName="hero_trial_click">
                Start free today <ArrowRight aria-hidden="true" />
              </TrackLink>
              <TrackLink className="button button-secondary button-large" href="/features" eventName="hero_product_click">
                Explore the product
              </TrackLink>
            </div>
            <div className="phase4-hero-proof">
              <span><Check /> No card required</span>
              <span><Check /> 9 supported networks</span>
              <span><Check /> 20 Trial AI credits</span>
            </div>
          </Reveal>

          <Reveal className="phase4-hero-product" delay={80}>
            <ProductShot
              src={productShots.dashboard}
              alt="INXSocial real dashboard showing publishing activity, engagement, connected accounts and recent posts"
              label="INXSocial Dashboard"
              caption="The actual product interface — not a recreated marketing mockup."
              eager
              className="phase4-hero-shot"
            />
            <div className="phase4-floating-note note-one">
              <span>Connected workflow</span>
              <strong>Post scheduled</strong>
              <small>Dashboard → Posts → Calendar</small>
            </div>
            <div className="phase4-floating-note note-two">
              <span>AI + publishing</span>
              <strong>One workspace</strong>
              <small>Create · Schedule · Analyse</small>
            </div>
          </Reveal>
        </div>
        <div className="container-shell phase4-trust">
          <span><b>9</b> supported networks</span>
          <span><b>7 days</b> free Trial</span>
          <span><b>Full</b> Analytics</span>
          <span><b>5</b> AI content workflows</span>
          <span><b>∞</b> paid-plan posts</span>
        </div>
      </section>

      <section className="phase4-light-section phase4-pillars" id="product">
        <div className="container-shell">
          <Reveal className="phase4-light-heading">
            <span>Everything you need to run social media</span>
            <h2>Powerful tools. A clearer way to work.</h2>
            <p>Every major part of the homepage now shows the real INXSocial interface, framed to explain the workflow instead of replacing it with a fake marketing UI.</p>
          </Reveal>

          <div className="phase4-pillar-grid">
            {pillars.map((pillar, index) => (
              <Reveal className="phase4-pillar-card" delay={index * 50} key={pillar.title}>
                <div className="phase4-pillar-head">
                  <span>{pillar.index}</span>
                  <div><h3>{pillar.title}</h3><p>{pillar.copy}</p></div>
                </div>
                <div className="phase4-pillar-media">
                  <img src={pillar.image} alt={pillar.alt} width="1280" height="860" loading="lazy" decoding="async" />
                </div>
                <TrackLink className="phase4-text-link" href={pillar.href} eventName="pillar_click" eventData={{ feature: pillar.title }}>
                  Explore {pillar.title} <ArrowRight />
                </TrackLink>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="phase4-dark-story" id="bulk-scheduler">
        <div className="container-shell phase4-story-grid">
          <Reveal className="phase4-story-copy">
            <span className="phase4-kicker">Bulk Scheduler</span>
            <h2>Publish more without repeating the same scheduling work.</h2>
            <p>The actual Bulk Scheduler already has a stronger product story than a fabricated landing-page illustration. Phase 4 uses it directly and lets the surrounding design explain why it matters.</p>
            <div className="phase4-feature-list">
              <div><span><Layers3 /></span><div><strong>Batch-first publishing</strong><p>Select destinations, upload media, add captions and choose timing in one session.</p></div></div>
              <div><span><CalendarDays /></span><div><strong>Scheduling built in</strong><p>Choose when the batch should publish without reopening the composer for each post.</p></div></div>
              <div><span><Send /></span><div><strong>Clear run status</strong><p>Monitor completed, failed and blocked publishing actions in the same workspace.</p></div></div>
            </div>
            <TrackLink className="button button-primary" href="/bulk-scheduler" eventName="phase4_bulk_click">Explore Bulk Scheduler <ArrowRight /></TrackLink>
          </Reveal>
          <Reveal className="phase4-story-shot" delay={80}>
            <ProductShot
              src={productShots.bulk}
              alt="INXSocial Bulk Scheduler with publishing destinations, media batch and run status"
              label="Bulk Scheduler"
              caption="Actual Bulk Scheduler interface"
            />
          </Reveal>
        </div>
      </section>

      <section className="phase4-ai-section" id="ai-studio">
        <div className="phase4-ai-halo" aria-hidden="true" />
        <div className="container-shell">
          <Reveal className="phase4-ai-heading">
            <div>
              <span className="phase4-kicker">AI-powered content creation</span>
              <h2>From idea to scroll-stopping content — without leaving the publishing workflow.</h2>
            </div>
            <div>
              <p>AI Content Studio is now presented as the hero product it actually is: real UI, real plan credits, and a stronger visual frame around Image Post, Carousel, Short Video and UGC creation.</p>
              <TrackLink className="phase4-light-link" href="/ai-content-studio" eventName="phase4_ai_click">Explore AI Content Studio <ArrowRight /></TrackLink>
            </div>
          </Reveal>

          <Reveal className="phase4-ai-stage" delay={70}>
            <ProductShot
              src={productShots.ai}
              alt="INXSocial AI Content Studio showing Image Post, Carousel Post, Short Video and UGC Ad creation"
              label="AI Content Studio"
              caption="Actual AI Content Studio interface"
              className="phase4-ai-shot"
            />
            <div className="phase4-ai-chip chip-image"><Sparkles /><span><strong>Image</strong><small>Generate visual + copy</small></span></div>
            <div className="phase4-ai-chip chip-carousel"><Layers3 /><span><strong>Carousel</strong><small>Multi-slide stories</small></span></div>
            <div className="phase4-ai-chip chip-video"><Video /><span><strong>Video</strong><small>AI + Stock Video Creator</small></span></div>
            <div className="phase4-ai-chip chip-ugc"><WandSparkles /><span><strong>UGC</strong><small>Creator-style promotion</small></span></div>
          </Reveal>
        </div>
      </section>

      <section className="phase4-light-section phase4-analytics-section" id="analytics">
        <div className="container-shell phase4-analytics-grid">
          <Reveal className="phase4-analytics-shot">
            <ProductShot
              src={productShots.analytics}
              alt="INXSocial Analytics showing account filters, post performance metrics and engagement by platform"
              label="Full Analytics"
              caption="Verified connected-account performance data"
            />
          </Reveal>
          <Reveal className="phase4-light-copy" delay={70}>
            <span>Full Analytics</span>
            <h2>Turn real publishing data into the next content decision.</h2>
            <p>Use the actual Analytics workspace to explain the product: selected account context, live metrics, content performance and platform engagement — not placeholder marketing charts.</p>
            <ul>
              <li><Check /> Selected connected-account analytics</li>
              <li><Check /> Content views, interactions and engagement rate</li>
              <li><Check /> Publish-date performance trends</li>
              <li><Check /> Engagement by platform</li>
            </ul>
            <TrackLink className="phase4-dark-link" href="/analytics" eventName="phase4_analytics_click">Explore Analytics <ArrowRight /></TrackLink>
          </Reveal>
        </div>
      </section>

      <section className="phase4-workflow">
        <div className="container-shell">
          <Reveal className="phase4-workflow-heading">
            <span>A seamless workflow</span>
            <h2>From creation to results — all in one flow.</h2>
            <p>Use AI or your own media, schedule across connected destinations, review performance and repeat what works.</p>
          </Reveal>
          <div className="phase4-flow-grid">
            {[
              ['01','Create',Sparkles,'Use AI or upload your own content.'],
              ['02','Schedule',CalendarDays,'Plan single posts or publish in batches.'],
              ['03','Analyse',BarChart3,'Track verified performance and engagement.'],
              ['04','Grow',Link2,'Use what works across your connected accounts.'],
            ].map(([number,title,Icon,copy], index) => {
              const FlowIcon = Icon as typeof Sparkles
              return <Reveal className="phase4-flow-step" delay={index * 45} key={String(title)}>
                <span className="phase4-flow-number">{String(number)}</span>
                <span className="phase4-flow-icon"><FlowIcon /></span>
                <h3>{String(title)}</h3>
                <p>{String(copy)}</p>
                {index < 3 && <ArrowRight className="phase4-flow-arrow" aria-hidden="true" />}
              </Reveal>
            })}
          </div>
          <Reveal className="phase4-platform-strip" delay={100}>
            <div><span>Connect major platforms</span><strong>Publish everywhere. Manage in one place.</strong></div>
            <div className="phase4-platform-marks">{platforms.map((platform) => <span key={platform.name} title={platform.name}>{platform.mark}</span>)}</div>
          </Reveal>
        </div>
      </section>

      <section className="phase4-pricing" id="pricing">
        <div className="container-shell">
          <Reveal className="phase4-pricing-heading">
            <span>Simple pricing</span>
            <h2>Start with the full workflow. Scale capacity when you need it.</h2>
          </Reveal>
          <div className="phase4-plan-grid">
            {paidPlans.map((plan, index) => (
              <Reveal className={`phase4-plan ${plan.featured ? 'featured' : ''}`} delay={index * 40} key={plan.id}>
                {plan.featured && <span className="phase4-popular">Most popular</span>}
                <small>{plan.eyebrow}</small>
                <h3>{plan.name}</h3>
                <div><sup>£</sup><strong>{plan.price.toFixed(2)}</strong><span>/month</span></div>
                <ul>
                  <li><Check /> {plan.accounts} connected accounts</li>
                  <li><Check /> Unlimited posts & scheduling</li>
                  <li><Check /> Full Analytics</li>
                  <li><Check /> {plan.credits.toLocaleString()} AI credits / month</li>
                  <li><Check /> {plan.support}</li>
                </ul>
                <TrackLink className={`button ${plan.featured ? 'button-primary' : 'phase4-outline-button'}`} href={planHref(plan.id)} eventName="pricing_plan_click" eventData={{ plan: plan.name }}>Choose {plan.name}</TrackLink>
              </Reveal>
            ))}
          </div>
          <Reveal className="phase4-trial-line">
            <div><span>7-day Trial</span><strong>2 accounts · 50 published posts · 20 AI credits · no card required</strong></div>
            <TrackLink className="button phase4-outline-button" href={site.registerUrl} eventName="phase4_trial_click">Start Trial <ArrowRight /></TrackLink>
          </Reveal>
        </div>
      </section>

      <section className="phase4-light-section phase4-faq">
        <div className="container-shell faq-grid">
          <Reveal className="phase4-light-copy">
            <span>Clear answers</span>
            <h2>Built as one product, not a bundle of disconnected tools.</h2>
            <p>Connected accounts, publishing, AI creation, scheduling, analytics and billing all remain part of the same INXSocial workflow.</p>
          </Reveal>
          <Reveal className="faq-list phase4-faq-list" delay={60}>
            {faqs.map(([question, answer], index) => <details className="faq-item" key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
          </Reveal>
        </div>
      </section>

      <section className="phase4-final">
        <div className="container-shell">
          <Reveal className="phase4-final-card">
            <div>
              <span>Ready to grow?</span>
              <h2>Start your INXSocial journey today.</h2>
              <p>Connect your accounts, create content, schedule at scale and understand what is working.</p>
            </div>
            <TrackLink className="button button-primary button-large" href={site.registerUrl} eventName="phase4_final_click">Start free today <ArrowRight /></TrackLink>
          </Reveal>
        </div>
      </section>
    </>
  )
}
