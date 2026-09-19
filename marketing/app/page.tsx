import type { Metadata } from 'next'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  ImageIcon,
  Layers3,
  Link2,
  Play,
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
              alt="INXSocial dashboard showing publishing activity, engagement, connected accounts and recent posts"
              label="INXSocial Dashboard"
              eager
              className="phase4-hero-shot"
            />
            <div className="phase4-floating-note note-one">
              <span>Connected workflow</span>
              <strong>One workspace</strong>
              <small>Create · Schedule · Analyse</small>
            </div>
            <div className="phase4-floating-note note-two">
              <span>Publishing overview</span>
              <strong>See what matters now</strong>
              <small>Posts · Schedule · Engagement</small>
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
            <p>The landing page explains the real product without turning every section into another screenshot. Only Dashboard and Analytics use real interface imagery; the rest is presented through cleaner marketing visuals inspired by the product design.</p>
          </Reveal>

          <div className="phase4-pillar-grid">
            <Reveal className="phase4-pillar-card" delay={0}>
              <div className="phase4-pillar-head">
                <span>01</span>
                <div><h3>Dashboard</h3><p>Understand publishing activity, engagement and account coverage at a glance.</p></div>
              </div>
              <DashboardMarketingVisual />
              <TrackLink className="phase4-text-link" href="/features" eventName="pillar_click" eventData={{ feature: 'Dashboard' }}>
                Explore Dashboard <ArrowRight />
              </TrackLink>
            </Reveal>

            <Reveal className="phase4-pillar-card" delay={50}>
              <div className="phase4-pillar-head">
                <span>02</span>
                <div><h3>Bulk Scheduler</h3><p>Prepare destinations, content and timing in one campaign-building flow.</p></div>
              </div>
              <BulkMarketingVisual compact />
              <TrackLink className="phase4-text-link" href="/bulk-scheduler" eventName="pillar_click" eventData={{ feature: 'Bulk Scheduler' }}>
                Explore Bulk Scheduler <ArrowRight />
              </TrackLink>
            </Reveal>

            <Reveal className="phase4-pillar-card" delay={100}>
              <div className="phase4-pillar-head">
                <span>03</span>
                <div><h3>Analytics</h3><p>Review real connected-account performance and publishing trends.</p></div>
              </div>
              <AnalyticsMarketingVisual />
              <TrackLink className="phase4-text-link" href="/analytics" eventName="pillar_click" eventData={{ feature: 'Analytics' }}>
                Explore Analytics <ArrowRight />
              </TrackLink>
            </Reveal>

            <Reveal className="phase4-pillar-card" delay={150}>
              <div className="phase4-pillar-head">
                <span>04</span>
                <div><h3>AI Content Studio</h3><p>Create images, carousels, short video and UGC-style content from one studio.</p></div>
              </div>
              <AIStudioMarketingVisual compact />
              <TrackLink className="phase4-text-link" href="/ai-content-studio" eventName="pillar_click" eventData={{ feature: 'AI Content Studio' }}>
                Explore AI Content Studio <ArrowRight />
              </TrackLink>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="phase4-dark-story" id="bulk-scheduler">
        <div className="container-shell phase4-story-grid">
          <Reveal className="phase4-story-copy">
            <span className="phase4-kicker">Bulk Scheduler</span>
            <h2>Publish more without repeating the same scheduling work.</h2>
            <p>Bulk Scheduler is presented as a clean campaign workflow rather than a literal screenshot. The design follows your product language — destinations, media, captions, timing and run status — while keeping the landing page visually premium.</p>
            <div className="phase4-feature-list">
              <div><span><Layers3 /></span><div><strong>Batch-first publishing</strong><p>Prepare several media items and captions inside one scheduling session.</p></div></div>
              <div><span><CalendarDays /></span><div><strong>Choose timing once</strong><p>Set the publishing mode and planned time instead of reopening the composer repeatedly.</p></div></div>
              <div><span><Send /></span><div><strong>Destination-aware</strong><p>Select the connected accounts that should receive the batch before publishing begins.</p></div></div>
            </div>
            <TrackLink className="button button-primary" href="/bulk-scheduler" eventName="phase4_bulk_click">Explore Bulk Scheduler <ArrowRight /></TrackLink>
          </Reveal>
          <Reveal className="phase4-story-shot" delay={80}>
            <BulkMarketingVisual />
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
              <p>AI Content Studio gets the strongest custom visual treatment on the page. The landing experience is inspired by your real Studio UI, but it is designed specifically for marketing rather than showing the application screenshot again.</p>
              <TrackLink className="phase4-light-link" href="/ai-content-studio" eventName="phase4_ai_click">Explore AI Content Studio <ArrowRight /></TrackLink>
            </div>
          </Reveal>

          <Reveal className="phase4-ai-stage phase4-ai-stage-custom" delay={70}>
            <AIStudioMarketingVisual />
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
            />
          </Reveal>
          <Reveal className="phase4-light-copy" delay={70}>
            <span>Full Analytics</span>
            <h2>Turn real publishing data into the next content decision.</h2>
            <p>Analytics is one of the places where the real product UI adds credibility. The landing page therefore uses your actual Analytics interface rather than a marketing recreation.</p>
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
              return (
                <Reveal className="phase4-flow-step" delay={index * 45} key={String(title)}>
                  <span className="phase4-flow-number">{String(number)}</span>
                  <span className="phase4-flow-icon"><FlowIcon /></span>
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                  {index < 3 && <ArrowRight className="phase4-flow-arrow" aria-hidden="true" />}
                </Reveal>
              )
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

function DashboardMarketingVisual() {
  return (
    <div className="marketing-mini marketing-dashboard-mini" aria-hidden="true">
      <div className="marketing-mini-kpis">
        <span><i /><strong>Published</strong><b>28</b></span>
        <span><i /><strong>Scheduled</strong><b>16</b></span>
        <span><i /><strong>Engagement</strong><b>8.4k</b></span>
      </div>
      <div className="marketing-mini-chart">
        <div className="chart-bars">{[36,62,48,82,56,91,72,87].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
        <div className="chart-line" />
      </div>
    </div>
  )
}

function AnalyticsMarketingVisual() {
  return (
    <div className="marketing-mini marketing-analytics-mini" aria-hidden="true">
      <div className="marketing-analytics-head"><span>Performance</span><strong>Last 30 days</strong></div>
      <div className="marketing-analytics-metrics">
        <span><small>Views</small><strong>12.8k</strong></span>
        <span><small>Engagement</small><strong>4.9%</strong></span>
        <span><small>Published</small><strong>84</strong></span>
      </div>
      <div className="marketing-analytics-graph"><i /><i /><i /><i /><b /></div>
    </div>
  )
}

function BulkMarketingVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`bulk-marketing-visual ${compact ? 'is-compact' : ''}`} aria-label="Bulk Scheduler marketing visual">
      <div className="bulk-visual-top">
        <div><span>Bulk Scheduler</span><strong>Campaign workspace</strong></div>
        <span className="bulk-status"><i /> Ready</span>
      </div>

      <div className="bulk-visual-steps">
        <div><span><Layers3 /></span><strong>Select destinations</strong><small>Choose connected accounts</small></div>
        <ArrowRight />
        <div><span><ImageIcon /></span><strong>Add content</strong><small>Media + captions</small></div>
        <ArrowRight />
        <div><span><Clock3 /></span><strong>Choose timing</strong><small>Publish or schedule</small></div>
      </div>

      <div className="bulk-visual-body">
        <div className="bulk-visual-content">
          <span className="visual-label">Content queue</span>
          {['Launch teaser','Carousel story','Product reel','Customer proof'].map((item, index) => (
            <div className="bulk-content-row" key={item}>
              <span className={`bulk-content-thumb tone-${index + 1}`} />
              <div><strong>{item}</strong><small>{index + 2} destinations</small></div>
              <Check />
            </div>
          ))}
        </div>

        <div className="bulk-visual-timing">
          <span className="visual-label">Planned timing</span>
          {['11:00','15:15','19:30','22:15'].map((time, index) => (
            <div className="bulk-time-row" key={time}><strong>{time}</strong><span>{['Mon','Tue','Wed','Thu'][index]}</span><i /></div>
          ))}
          <div className="bulk-run-card"><span>Batch run</span><strong>12 posts ready</strong><div><i /></div></div>
        </div>
      </div>
    </div>
  )
}

function AIStudioMarketingVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ai-marketing-visual ${compact ? 'is-compact' : ''}`} aria-label="AI Content Studio marketing visual">
      <div className="ai-visual-glow" aria-hidden="true" />
      <div className="ai-visual-top">
        <div><span><Sparkles /> AI Content Studio</span><strong>Turn ideas into social-ready creative.</strong></div>
        <span className="ai-credit-pill"><i /> Shared AI credits</span>
      </div>

      <div className="ai-visual-grid">
        <div className="ai-format-card image-format">
          <span><ImageIcon /> Single visual</span>
          <strong>Image Post</strong>
          <p>Visual, caption, hashtags and alt text.</p>
          <div className="image-format-art"><i /><b /><b /></div>
        </div>

        <div className="ai-format-card carousel-format">
          <span><Layers3 /> Multi-slide</span>
          <strong>Carousel</strong>
          <p>Coordinated slides and per-slide copy.</p>
          <div className="carousel-format-art"><i /><i /><i /></div>
        </div>

        <div className="ai-format-card video-format">
          <span><Video /> Short video</span>
          <strong>Video / Reel</strong>
          <p>AI video or Stock Video Creator.</p>
          <div className="video-format-art"><span><Play /></span><i /><i /><i /></div>
        </div>

        <div className="ai-format-card ugc-format">
          <span><WandSparkles /> Creator style</span>
          <strong>UGC Ad</strong>
          <p>Promotional creative from a campaign brief.</p>
          <div className="ugc-format-art"><span>UGC</span><b>Real people.<br />Real results.</b></div>
        </div>
      </div>

      {!compact && (
        <div className="ai-visual-flow">
          <span><i /> Idea</span><ArrowRight /><span><i /> Generate</span><ArrowRight /><span><i /> Refine</span><ArrowRight /><span><i /> Send to Posts</span>
        </div>
      )}
    </div>
  )
}
