import type { Metadata } from 'next'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ImageIcon,
  Layers3,
  Send,
  Sparkles,
  Video,
  WandSparkles,
} from 'lucide-react'
import { FAQSchema } from '@/components/faq-schema'
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
  return id === 'trial' ? site.registerUrl : site.registerUrl + '?plan=' + id.toUpperCase()
}

export default function HomePage() {
  return (
    <div className="lp-home">
      <FAQSchema />

      <section className="lp-hero">
        <div className="lp-hero-orb lp-orb-one" aria-hidden="true" />
        <div className="lp-hero-orb lp-orb-two" aria-hidden="true" />

        <div className="container-shell lp-hero-copy">
          <Reveal>
            <span className="lp-eyebrow">Social media, without the busywork</span>
            <h1>Create more. Schedule faster. <span>Know what works.</span></h1>
            <p>
              INXSocial brings content creation, bulk scheduling, publishing and analytics into one clean workspace
              for creators, brands and teams.
            </p>

            <div className="lp-hero-actions">
              <TrackLink className="lp-button lp-button-primary" href={site.registerUrl} eventName="hero_trial_click">
                Start free trial <ArrowRight aria-hidden="true" />
              </TrackLink>
              <TrackLink className="lp-button lp-button-secondary" href="/features" eventName="hero_product_click">
                Explore the product
              </TrackLink>
            </div>

            <div className="lp-proof-row">
              <span><Check /> No card required</span>
              <span><Check /> 7-day Trial</span>
              <span><Check /> 9 supported networks</span>
            </div>
          </Reveal>
        </div>

        <div className="container-shell lp-hero-stage">
          <Reveal delay={80} className="lp-dashboard-shell">
            <div className="lp-stage-topline">
              <div>
                <span className="lp-stage-dot" />
                <strong>INXSocial workspace</strong>
              </div>
              <span>Dashboard</span>
            </div>
            <div className="lp-dashboard-image">
              <img
                src="/product/inxsocial-dashboard-real.webp"
                alt="INXSocial dashboard showing publishing activity, connected accounts, engagement and recent posts"
                width="1600"
                height="1000"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
          </Reveal>
        </div>

        <div className="container-shell lp-platform-band">
          <span className="lp-platform-label">One workflow across your social channels</span>
          <div className="lp-platforms" aria-label="Supported social platforms">
            {platforms.map((platform) => (
              <span className="lp-platform" key={platform.name} title={platform.name}>
                <i>{platform.mark}</i>
                <b>{platform.name}</b>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-product-section" id="product">
        <div className="container-shell">
          <Reveal className="lp-section-heading">
            <span className="lp-eyebrow">Everything in one place</span>
            <h2>A simpler system for running social media.</h2>
            <p>
              Move from idea to published content without jumping between disconnected tools. Each part of INXSocial
              is designed to feed naturally into the next.
            </p>
          </Reveal>

          <div className="lp-feature-grid">
            <Reveal className="lp-feature-card lp-feature-create">
              <div className="lp-feature-icon"><Sparkles /></div>
              <span>Create</span>
              <h3>Make content inside the workflow.</h3>
              <p>Generate images, carousels, short video, UGC-style creative or start with your own media.</p>
              <TrackLink href="/ai-content-studio" eventName="feature_create_click">
                AI Content Studio <ArrowRight />
              </TrackLink>
            </Reveal>

            <Reveal className="lp-feature-card lp-feature-schedule" delay={40}>
              <div className="lp-feature-icon"><CalendarDays /></div>
              <span>Schedule</span>
              <h3>Plan one post or an entire batch.</h3>
              <p>Choose destinations, captions and timing once, then build your schedule without repetitive setup.</p>
              <TrackLink href="/bulk-scheduler" eventName="feature_schedule_click">
                Bulk Scheduler <ArrowRight />
              </TrackLink>
            </Reveal>

            <Reveal className="lp-feature-card lp-feature-publish" delay={80}>
              <div className="lp-feature-icon"><Send /></div>
              <span>Publish</span>
              <h3>Keep connected accounts together.</h3>
              <p>Manage publishing destinations from one workspace and keep the content pipeline clear.</p>
              <TrackLink href="/connected-accounts" eventName="feature_publish_click">
                Connected Accounts <ArrowRight />
              </TrackLink>
            </Reveal>

            <Reveal className="lp-feature-card lp-feature-analyse" delay={120}>
              <div className="lp-feature-icon"><BarChart3 /></div>
              <span>Analyse</span>
              <h3>See what earns attention.</h3>
              <p>Review connected-account performance, content views, interactions and engagement trends.</p>
              <TrackLink href="/analytics" eventName="feature_analyse_click">
                Full Analytics <ArrowRight />
              </TrackLink>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="lp-section lp-bulk-section" id="bulk-scheduler">
        <div className="container-shell lp-split-grid">
          <Reveal className="lp-story-copy">
            <span className="lp-eyebrow">Bulk Scheduler</span>
            <h2>Stop rebuilding the same schedule post by post.</h2>
            <p>
              Prepare a batch in one focused workflow: pick the connected destinations, add the media and captions,
              choose timing, then let the schedule take shape.
            </p>

            <div className="lp-check-list">
              <span><Check /> Multiple items in one session</span>
              <span><Check /> Destination selection before publishing</span>
              <span><Check /> Planned timing without reopening each post</span>
            </div>

            <TrackLink className="lp-inline-link" href="/bulk-scheduler" eventName="bulk_story_click">
              Explore Bulk Scheduler <ArrowRight />
            </TrackLink>
          </Reveal>

          <Reveal className="lp-bulk-visual" delay={70}>
            <div className="lp-bulk-head">
              <div>
                <span>Bulk Scheduler</span>
                <strong>Build your publishing batch</strong>
              </div>
              <span className="lp-ready-pill"><i /> Ready</span>
            </div>

            <div className="lp-bulk-destinations">
              <span className="is-active">f <b>Facebook</b></span>
              <span className="is-active">◎ <b>Instagram</b></span>
              <span>in <b>LinkedIn</b></span>
              <span>♪ <b>TikTok</b></span>
            </div>

            <div className="lp-bulk-body">
              <div className="lp-bulk-queue">
                <small>CONTENT QUEUE</small>
                {[
                  ['Launch image', 'Image + caption'],
                  ['Feature carousel', '6 slides'],
                  ['Product reel', 'Short video'],
                ].map(([title, meta], index) => (
                  <div className="lp-queue-item" key={title}>
                    <span className={'lp-queue-thumb thumb-' + (index + 1)} />
                    <div><strong>{title}</strong><span>{meta}</span></div>
                    <Check />
                  </div>
                ))}
              </div>

              <div className="lp-bulk-timing">
                <small>PLANNED SLOTS</small>
                {['11:00', '15:15', '19:30'].map((time, index) => (
                  <div className="lp-slot" key={time}>
                    <strong>{time}</strong>
                    <span>{['Mon', 'Tue', 'Wed'][index]}</span>
                    <i />
                  </div>
                ))}
                <button type="button" tabIndex={-1}>Build schedule</button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-ai-section" id="ai-studio">
        <div className="lp-ai-glow" aria-hidden="true" />
        <div className="container-shell">
          <Reveal className="lp-ai-heading">
            <div>
              <span className="lp-eyebrow lp-eyebrow-dark">AI Content Studio</span>
              <h2>Start with an idea. Leave with content ready to publish.</h2>
            </div>
            <div>
              <p>
                Create different formats in the same studio, refine the result and move finished content straight
                into Posts without rebuilding it elsewhere.
              </p>
              <TrackLink className="lp-inline-link lp-inline-link-light" href="/ai-content-studio" eventName="ai_story_click">
                Explore AI Content Studio <ArrowRight />
              </TrackLink>
            </div>
          </Reveal>

          <Reveal className="lp-ai-workspace" delay={70}>
            <div className="lp-ai-toolbar">
              <div><Sparkles /><strong>AI Content Studio</strong></div>
              <span>Shared AI credits</span>
            </div>

            <div className="lp-ai-prompt">
              <span>What do you want to create?</span>
              <strong>Turn a product idea into a polished social campaign...</strong>
              <button type="button" tabIndex={-1}><WandSparkles /> Create</button>
            </div>

            <div className="lp-ai-formats">
              <div>
                <span><ImageIcon /></span>
                <strong>Image Post</strong>
                <small>Visual + caption</small>
              </div>
              <div>
                <span><Layers3 /></span>
                <strong>Carousel</strong>
                <small>Multi-slide content</small>
              </div>
              <div>
                <span><Video /></span>
                <strong>Short Video / Reel</strong>
                <small>AI or stock video</small>
              </div>
              <div>
                <span><WandSparkles /></span>
                <strong>UGC Ad</strong>
                <small>Creator-style concept</small>
              </div>
            </div>

            <div className="lp-ai-flow">
              <span>Idea</span><i />
              <span>Generate</span><i />
              <span>Refine</span><i />
              <span>Send to Posts</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-analytics-section" id="analytics">
        <div className="container-shell lp-split-grid lp-analytics-grid">
          <Reveal className="lp-analytics-frame">
            <div className="lp-stage-topline lp-stage-topline-light">
              <div><span className="lp-stage-dot" /><strong>INXSocial Analytics</strong></div>
              <span>Live workspace</span>
            </div>
            <img
              src="/product/inxsocial-analytics-real.webp"
              alt="INXSocial Analytics showing content performance, views, interactions and engagement by platform"
              width="1600"
              height="1000"
              loading="lazy"
              decoding="async"
            />
          </Reveal>

          <Reveal className="lp-story-copy lp-analytics-copy" delay={70}>
            <span className="lp-eyebrow">Full Analytics</span>
            <h2>Turn performance data into the next content decision.</h2>
            <p>
              Review the metrics that matter in the same product you use to create and schedule content, so the next
              decision starts with real connected-account data.
            </p>

            <div className="lp-check-list">
              <span><Check /> Content views and interactions</span>
              <span><Check /> Engagement rate and publishing trends</span>
              <span><Check /> Platform-level performance context</span>
            </div>

            <TrackLink className="lp-inline-link" href="/analytics" eventName="analytics_story_click">
              Explore Analytics <ArrowRight />
            </TrackLink>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-flow-section">
        <div className="container-shell">
          <Reveal className="lp-section-heading lp-section-heading-center">
            <span className="lp-eyebrow">One connected workflow</span>
            <h2>Create → Schedule → Publish → Analyse.</h2>
            <p>Keep the full social-content loop inside one workspace and repeat what works.</p>
          </Reveal>

          <div className="lp-flow-grid">
            {[
              ['01', 'Create', 'Use AI or your own media.'],
              ['02', 'Schedule', 'Plan single posts or batches.'],
              ['03', 'Publish', 'Send content to connected destinations.'],
              ['04', 'Analyse', 'Use performance to guide the next idea.'],
            ].map(([number, title, copy], index) => (
              <Reveal className="lp-flow-card" delay={index * 40} key={title}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{copy}</p>
                {index < 3 && <ArrowRight aria-hidden="true" />}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-pricing-section" id="pricing">
        <div className="container-shell">
          <Reveal className="lp-section-heading">
            <span className="lp-eyebrow">Simple pricing</span>
            <h2>Choose the capacity that fits your workflow.</h2>
            <p>Every paid plan includes unlimited posts and scheduling, Full Analytics and a monthly AI credit allowance.</p>
          </Reveal>

          <div className="lp-plan-grid">
            {paidPlans.map((plan, index) => (
              <Reveal className={'lp-plan ' + (plan.featured ? 'is-featured' : '')} delay={index * 35} key={plan.id}>
                {plan.featured && <span className="lp-popular">Most popular</span>}
                <small>{plan.eyebrow}</small>
                <h3>{plan.name}</h3>
                <div className="lp-price"><sup>£</sup><strong>{plan.price.toFixed(2)}</strong><span>/month</span></div>
                <ul>
                  <li><Check /> {plan.accounts} connected accounts</li>
                  <li><Check /> Unlimited posts & scheduling</li>
                  <li><Check /> Full Analytics</li>
                  <li><Check /> {plan.credits.toLocaleString()} AI credits / month</li>
                </ul>
                <TrackLink className="lp-plan-button" href={planHref(plan.id)} eventName="pricing_plan_click" eventData={{ plan: plan.name }}>
                  Choose {plan.name}
                </TrackLink>
              </Reveal>
            ))}
          </div>

          <Reveal className="lp-trial-strip">
            <div>
              <span>7-day Trial</span>
              <strong>2 accounts · 50 published posts · 20 AI credits · no card required</strong>
            </div>
            <TrackLink className="lp-button lp-button-secondary" href={site.registerUrl} eventName="trial_strip_click">
              Start free trial <ArrowRight />
            </TrackLink>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-faq-section">
        <div className="container-shell lp-faq-grid">
          <Reveal className="lp-story-copy">
            <span className="lp-eyebrow">Questions answered</span>
            <h2>Everything works as one product.</h2>
            <p>Connected accounts, publishing, AI creation, scheduling, analytics and billing stay in the same INXSocial workflow.</p>
          </Reveal>

          <Reveal className="lp-faq-list" delay={60}>
            {faqs.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary>{question}<span>+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="lp-final">
        <div className="container-shell">
          <Reveal className="lp-final-card">
            <div>
              <span className="lp-eyebrow lp-eyebrow-dark">Ready when you are</span>
              <h2>Run your social workflow from one place.</h2>
              <p>Connect your accounts, create content, schedule at scale and understand what is working.</p>
            </div>
            <TrackLink className="lp-button lp-button-primary" href={site.registerUrl} eventName="final_trial_click">
              Start free trial <ArrowRight />
            </TrackLink>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
