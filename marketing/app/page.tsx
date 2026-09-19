import type { Metadata } from 'next'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  ImageIcon,
  Layers3,
  LayoutDashboard,
  Library,
  Link2,
  MessageSquareText,
  Play,
  Send,
  Sparkles,
  Video,
  WandSparkles,
  Waypoints,
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

const capabilities = [
  {
    icon: Send,
    title: 'Post Creation',
    text: 'Create text, image, carousel and video posts, choose destinations and preview before publishing.',
    className: 'capability-standard',
  },
  {
    icon: Layers3,
    title: 'Bulk Scheduler',
    text: 'Prepare multiple media items, captions, destinations and timing rules, then build an entire publishing schedule in one flow.',
    className: 'capability-featured',
  },
  {
    icon: CalendarDays,
    title: 'Content Calendar',
    text: 'See scheduled and published content in one visual calendar with account, platform and status context.',
    className: 'capability-standard',
  },
  {
    icon: Sparkles,
    title: 'AI Content Studio',
    text: 'Generate images, carousels, short-form video, UGC-style creative and publishing copy without leaving the workflow.',
    className: 'capability-ai',
  },
  {
    icon: BarChart3,
    title: 'Full Analytics',
    text: 'Track post performance, engagement and measured trends across selected connected destinations.',
    className: 'capability-standard',
  },
  {
    icon: Link2,
    title: 'Connected Accounts',
    text: 'Manage pages, brands and destinations once, then reuse them across Posts, Scheduler and Analytics.',
    className: 'capability-standard',
  },
]

const workflow = [
  ['01', 'Connect', 'Authorise your social destinations once and keep them available across INXSocial.'],
  ['02', 'Create', 'Write manually or use AI-assisted media and caption workflows to move faster.'],
  ['03', 'Schedule', 'Publish now, schedule one post, or build a complete batch schedule.'],
  ['04', 'Publish', 'Keep destination and publishing status visible from the same workspace.'],
  ['05', 'Analyse', 'Review performance and feed the insight into the next content cycle.'],
] as const

const paidPlans = plans.filter((plan) => plan.id !== 'trial')
const trial = plans[0]

function planHref(id: string) {
  if (id === 'trial') return site.registerUrl
  return `${site.registerUrl}?plan=${id.toUpperCase()}`
}

export default function HomePage() {
  return (
    <>
      <FAQSchema />

      <section className="hero hero-phase-two section" id="top">
        <div className="hero-grid-glow" aria-hidden="true" />
        <div className="hero-grid-lines" aria-hidden="true" />
        <div className="container-shell hero-grid">
          <Reveal className="hero-copy">
            <span className="eyebrow">All-in-one social media management + AI creation</span>
            <h1>Create. Schedule.<br />Analyse. <span>Grow.</span></h1>
            <p>Run your social media from one workspace — create content, plan campaigns, publish across connected destinations and understand what is working.</p>
            <div className="hero-actions">
              <TrackLink className="button button-primary button-large" href={site.registerUrl} eventName="hero_trial_click">
                Start free trial <ArrowRight aria-hidden="true" />
              </TrackLink>
              <TrackLink className="button button-secondary button-large" href="#product" eventName="hero_product_click">
                Explore the product
              </TrackLink>
            </div>
            <div className="hero-proof" aria-label="Trial highlights">
              <span>7-day trial</span>
              <span>9 supported platforms</span>
              <span>20 AI credits</span>
              <span>No card required</span>
            </div>
          </Reveal>

          <Reveal className="hero-product hero-dashboard" delay={90}>
            <div className="dashboard-frame">
              <div className="dashboard-frame-top">
                <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
                <span>INXSocial workspace</span>
                <span className="live-pill"><i /> Live product</span>
              </div>
              <div className="dashboard-image-shell">
                <img
                  src="https://social.inaxx.co.uk/assets/inx-social-dashboard.jpg"
                  width="1640"
                  height="922"
                  alt="INXSocial dashboard showing publishing activity, scheduling, engagement, connected accounts and content performance"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            </div>
            <div className="floating-product-card product-float-one">
              <span>Bulk Scheduler</span>
              <strong>Campaign ready</strong>
              <small><Clock3 aria-hidden="true" /> Build schedules in one flow</small>
            </div>
            <div className="floating-product-card product-float-two">
              <span>AI Content Studio</span>
              <strong>One shared credit wallet</strong>
              <small><Sparkles aria-hidden="true" /> Image · Carousel · Video · UGC</small>
            </div>
          </Reveal>
        </div>

        <div className="container-shell trust-rail" aria-label="INXSocial product highlights">
          <span><b>9</b> social networks</span>
          <span><b>∞</b> paid-plan posts</span>
          <span><b>1</b> connected workspace</span>
          <span><b>5</b> AI content workflows</span>
          <span><b>Full</b> analytics</span>
        </div>
      </section>

      <section className="section platforms-section" id="platforms">
        <div className="container-shell">
          <Reveal className="section-heading centered compact-heading">
            <span className="eyebrow">Supported platforms</span>
            <h2>Publish across the networks your audience already uses.</h2>
            <p>Connect once, then use the same destinations throughout Posts, Scheduler, Calendar and Analytics.</p>
          </Reveal>
          <Reveal className="platform-grid" delay={80}>
            {platforms.map((platform) => (
              <div className="platform-card" key={platform.name}>
                <span className="platform-mark" style={{ '--platform-tone': platform.tone } as React.CSSProperties}>{platform.mark}</span>
                <strong>{platform.name}</strong>
              </div>
            ))}
          </Reveal>
          <Reveal className="platform-caption" delay={120}><span /> Nine supported social platforms. One publishing workspace. <span /></Reveal>
        </div>
      </section>

      <section className="section product-section" id="product">
        <div className="container-shell">
          <Reveal className="section-heading centered">
            <span className="eyebrow">One connected product</span>
            <h2>Everything you need to run social content without stitching tools together.</h2>
            <p>Move from creation to publishing and measurement in a workflow designed to keep accounts, media and schedules connected.</p>
          </Reveal>

          <div className="capability-grid">
            {capabilities.map(({ icon: Icon, title, text, className }, index) => (
              <Reveal className={`capability-card ${className}`} delay={index * 45} key={title}>
                <span className="capability-icon"><Icon aria-hidden="true" /></span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                {title === 'Bulk Scheduler' && (
                  <div className="mini-schedule" aria-hidden="true">
                    <span><i /> 11:00</span><span><i /> 15:15</span><span><i /> 19:30</span>
                  </div>
                )}
                {title === 'AI Content Studio' && (
                  <div className="mini-ai-rail" aria-hidden="true"><i /><i /><i /><i /></div>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="container-shell">
          <Reveal className="section-heading centered compact-heading">
            <span className="eyebrow">Simple workflow</span>
            <h2>From idea to insight in five clear steps.</h2>
          </Reveal>
          <div className="workflow-track">
            {workflow.map(([number, title, text], index) => (
              <Reveal className="workflow-step" delay={index * 55} key={number}>
                <span className="workflow-number">{number}</span>
                <div className="workflow-dot" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section proof-section">
        <div className="container-shell proof-grid">
          <Reveal className="proof-copy">
            <span className="eyebrow">See the real product</span>
            <h2>A dashboard built around the work you actually need to do.</h2>
            <p>Keep publishing activity, account coverage, schedule status and performance visible without bouncing between nine separate platforms.</p>
            <ul className="check-list">
              <li><Check aria-hidden="true" /> See scheduled, draft and publishing status at a glance</li>
              <li><Check aria-hidden="true" /> Track distribution across connected destinations</li>
              <li><Check aria-hidden="true" /> Move directly into Posts, Scheduler, Analytics or AI Studio</li>
              <li><Check aria-hidden="true" /> Keep generated media available inside Media Library</li>
            </ul>
            <TrackLink className="button button-primary" href={site.registerUrl} eventName="dashboard_trial_click">
              Start free trial <ArrowRight aria-hidden="true" />
            </TrackLink>
          </Reveal>
          <Reveal className="proof-dashboard" delay={90}>
            <div className="proof-dashboard-label"><LayoutDashboard aria-hidden="true" /> Actual INXSocial dashboard</div>
            <img
              src="https://social.inaxx.co.uk/assets/inx-social-dashboard.jpg"
              width="1640"
              height="922"
              alt="Actual INXSocial product dashboard"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
        </div>
      </section>

      <section className="section bulk-section" id="bulk-scheduler">
        <div className="bulk-halo" aria-hidden="true" />
        <div className="container-shell bulk-grid">
          <Reveal className="bulk-copy">
            <span className="eyebrow">Bulk Scheduler</span>
            <h2>Stop building your campaign one post at a time.</h2>
            <p>Prepare a batch of media, captions and destinations, then let INXSocial turn the batch into a clear publishing schedule.</p>
            <div className="feature-points">
              <div><span><Library aria-hidden="true" /></span><div><strong>Bring the batch together</strong><p>Work with multiple media items and captions in one scheduling session.</p></div></div>
              <div><span><Waypoints aria-hidden="true" /></span><div><strong>Choose destinations once</strong><p>Assign the accounts and platforms that should receive each item.</p></div></div>
              <div><span><CalendarDays aria-hidden="true" /></span><div><strong>Build the schedule</strong><p>Spread content across planned slots instead of manually creating every scheduled post.</p></div></div>
            </div>
            <TrackLink className="button button-secondary" href={site.registerUrl} eventName="bulk_trial_click">Try Bulk Scheduler <ArrowRight aria-hidden="true" /></TrackLink>
          </Reveal>

          <Reveal className="scheduler-visual" delay={90}>
            <div className="scheduler-window">
              <div className="scheduler-top">
                <div><span className="scheduler-kicker">Build Schedule</span><strong>Autumn campaign</strong></div>
                <span className="schedule-ready">12 items ready</span>
              </div>
              <div className="scheduler-columns">
                <div className="asset-stack">
                  <span className="column-label">Content queue</span>
                  {[1,2,3,4].map((item) => (
                    <div className="asset-row" key={item}>
                      <span className={`asset-thumb asset-thumb-${item}`} />
                      <div><strong>{['Launch teaser','Carousel story','Product reel','Customer proof'][item-1]}</strong><small>{['3 destinations','2 destinations','4 destinations','3 destinations'][item-1]}</small></div>
                      <i />
                    </div>
                  ))}
                </div>
                <div className="slot-stack">
                  <span className="column-label">Planned slots</span>
                  {['11:00','15:15','19:30','22:15'].map((time, index) => (
                    <div className="slot-row" key={time}><span>{time}</span><div><b>{['Mon','Tue','Wed','Thu'][index]}</b><small>Auto assigned</small></div><Check aria-hidden="true" /></div>
                  ))}
                </div>
              </div>
              <div className="scheduler-footer"><span>12 posts · 4 days · 3 networks</span><button type="button" tabIndex={-1}>Build schedule</button></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section ai-studio-section" id="ai-studio">
        <div className="container-shell">
          <Reveal className="ai-studio-heading">
            <div>
              <span className="eyebrow eyebrow-light">AI Content Studio</span>
              <h2>Create the media and the publishing copy in the same workflow.</h2>
            </div>
            <div>
              <p>Generate, refine and move finished creative straight into Posts. One shared AI-credit wallet covers image, carousel, video, UGC and Stock Video Creator workflows.</p>
              <TrackLink className="text-arrow-link" href={site.appUrl} eventName="ai_studio_open_click">Open AI Content Studio <ArrowRight aria-hidden="true" /></TrackLink>
            </div>
          </Reveal>

          <div className="ai-bento">
            <Reveal className="ai-card ai-image-card">
              <div className="ai-card-copy"><span><ImageIcon aria-hidden="true" /> Image</span><h3>Image Post</h3><p>Generate a visual with caption, hashtags and alt text ready for publishing.</p></div>
              <div className="ai-image-art" aria-hidden="true"><div className="ai-photo"><i /><span /></div><b /><b /><b /></div>
            </Reveal>

            <Reveal className="ai-card ai-carousel-card" delay={50}>
              <div className="ai-card-copy"><span><Layers3 aria-hidden="true" /> Carousel</span><h3>Carousel Post</h3><p>Build coordinated multi-slide stories with per-slide copy and links.</p></div>
              <div className="ai-carousel-art" aria-hidden="true"><i className="slide slide-three" /><i className="slide slide-two" /><i className="slide slide-one"><span /></i><small>1 / 4</small></div>
            </Reveal>

            <Reveal className="ai-card ai-video-card" delay={100}>
              <div className="ai-card-copy"><span><Video aria-hidden="true" /> Video</span><h3>Short Video / Reel</h3><p>Choose AI-generated video or Stock Video Creator inside the same video workflow.</p></div>
              <div className="ai-video-art" aria-hidden="true"><div className="video-device"><div /><Play /></div><span className="video-wave"><i /><i /><i /><i /><i /><i /></span></div>
            </Reveal>

            <Reveal className="ai-card ai-ugc-card" delay={150}>
              <div className="ai-card-copy"><span><WandSparkles aria-hidden="true" /> UGC</span><h3>UGC Ad Post</h3><p>Create creator-style promotional content around a product, service or campaign brief.</p></div>
              <div className="ugc-art" aria-hidden="true"><div className="ugc-profile">UGC</div><div className="ugc-quote">Real creative.<br />Built to publish.</div><span /></div>
            </Reveal>

            <Reveal className="ai-card ai-clipping-card" delay={190}>
              <div className="ai-card-copy"><span><MessageSquareText aria-hidden="true" /> Coming soon</span><h3>AI Video Clipping</h3><p>Turn longer video into social-ready moments with an assisted clipping workflow.</p></div>
              <div className="clip-art" aria-hidden="true"><div className="clip-track">{[1,2,3,4,5,6].map((i)=><i key={i} />)}</div><span className="clip-selection" /><ScissorsMark /></div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section analytics-section" id="analytics">
        <div className="container-shell analytics-grid">
          <Reveal className="analytics-visual">
            <div className="analytics-panel">
              <div className="analytics-panel-head"><div><span>Performance overview</span><strong>Last 30 days</strong></div><span className="analytics-live"><i /> Live data</span></div>
              <div className="analytics-kpis">
                <div><span>Published</span><strong>84</strong><small>+18%</small></div>
                <div><span>Engagement</span><strong>12.8k</strong><small>+24%</small></div>
                <div><span>Reach</span><strong>96.4k</strong><small>+31%</small></div>
              </div>
              <div className="chart-shell" aria-hidden="true">
                <div className="chart-gridlines"><i /><i /><i /><i /></div>
                <svg viewBox="0 0 600 180" role="presentation"><path d="M0 150 C60 148 72 110 125 116 S208 150 255 100 S339 55 390 82 S485 38 600 26" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /><path d="M0 150 C60 148 72 110 125 116 S208 150 255 100 S339 55 390 82 S485 38 600 26 L600 180 L0 180 Z" fill="currentColor" opacity=".08" /></svg>
              </div>
              <div className="analytics-platforms"><span><i /> Facebook <b>38%</b></span><span><i /> Instagram <b>31%</b></span><span><i /> LinkedIn <b>18%</b></span><span><i /> Other <b>13%</b></span></div>
            </div>
          </Reveal>
          <Reveal className="analytics-copy" delay={70}>
            <span className="eyebrow">Full Analytics</span>
            <h2>Understand what is working without leaving the publishing workflow.</h2>
            <p>Keep measured post performance, engagement and platform distribution beside the content and schedules that produced it.</p>
            <ul className="check-list">
              <li><Check aria-hidden="true" /> Performance across selected connected accounts</li>
              <li><Check aria-hidden="true" /> Engagement and publishing trend visibility</li>
              <li><Check aria-hidden="true" /> Platform and content distribution context</li>
              <li><Check aria-hidden="true" /> Included on Trial and every paid plan</li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section pricing-section" id="pricing">
        <div className="container-shell">
          <Reveal className="section-heading centered">
            <span className="eyebrow">Simple, transparent pricing</span>
            <h2>Same workflow. More capacity as you grow.</h2>
            <p>Every plan includes scheduling, Bulk Scheduler, Full Analytics, AI caption assistance and AI Content Studio access.</p>
          </Reveal>

          <Reveal className="trial-strip" delay={50}>
            <div><span className="trial-badge">7-day Trial</span><strong>Try the real workflow before you pay.</strong><p>2 connected accounts · 50 published posts · 20 AI credits · no card required</p></div>
            <TrackLink className="button button-secondary" href={site.registerUrl} eventName="pricing_trial_click">Start Trial <ArrowRight aria-hidden="true" /></TrackLink>
          </Reveal>

          <div className="paid-plan-grid">
            {paidPlans.map((plan, index) => (
              <Reveal className={`price-card phase-two-price-card ${plan.featured ? 'featured' : ''}`} delay={index * 45} key={plan.id}>
                {plan.featured && <span className="popular-badge">Most popular</span>}
                <span className="plan-eyebrow">{plan.eyebrow}</span>
                <h3>{plan.name}</h3>
                <div className="plan-price"><sup>£</sup><strong>{plan.price.toFixed(2)}</strong><span>/ month</span></div>
                <ul>
                  <li><Check aria-hidden="true" /> Up to {plan.accounts} connected accounts</li>
                  <li><Check aria-hidden="true" /> {plan.posts} & scheduling</li>
                  <li><Check aria-hidden="true" /> Bulk Scheduler + Full Analytics</li>
                  <li><Check aria-hidden="true" /> All AI caption assistance</li>
                  <li><Check aria-hidden="true" /> {plan.credits.toLocaleString()} AI credits / month</li>
                  <li><Check aria-hidden="true" /> {plan.support}</li>
                </ul>
                <TrackLink className={`button ${plan.featured ? 'button-primary' : 'button-secondary'}`} href={planHref(plan.id)} eventName="pricing_plan_click" eventData={{ plan: plan.name }}>
                  Choose {plan.name}
                </TrackLink>
              </Reveal>
            ))}
          </div>
          <Reveal className="pricing-footnote">AI credits are shared across image, carousel, AI video, UGC and Stock Video Creator workflows. Paid plans can add one-time top-up packs.</Reveal>
        </div>
      </section>

      <section className="section faq-section" id="faq">
        <div className="container-shell faq-grid">
          <Reveal className="faq-intro">
            <span className="eyebrow">Clear answers</span>
            <h2>Everything stays part of one INXSocial workspace.</h2>
            <p>From connected accounts to AI generation and billing, the product is designed as one continuous workflow.</p>
            <TrackLink className="text-arrow-link" href={site.registerUrl} eventName="faq_trial_click">Start free trial <ArrowRight aria-hidden="true" /></TrackLink>
          </Reveal>
          <Reveal className="faq-list" delay={70}>
            {faqs.map(([question, answer], index) => (
              <details className="faq-item" key={question} open={index === 0}>
                <summary>{question}<span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="section final-cta-section">
        <div className="container-shell">
          <Reveal className="final-cta-card">
            <div className="final-cta-orb" aria-hidden="true" />
            <div>
              <span className="eyebrow eyebrow-light">Ready to simplify the workflow?</span>
              <h2>Run your social media from one connected workspace.</h2>
              <p>Connect your accounts, create content, schedule at scale and understand what is working.</p>
            </div>
            <div className="final-actions">
              <TrackLink className="button button-primary button-large" href={site.registerUrl} eventName="final_trial_click">Start free trial <ArrowRight aria-hidden="true" /></TrackLink>
              <TrackLink className="button button-secondary button-large" href={site.appUrl} eventName="final_login_click">Sign in</TrackLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}

function ScissorsMark() {
  return <span className="scissors-mark" aria-hidden="true">✂</span>
}
