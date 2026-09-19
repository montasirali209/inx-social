import { ArrowRight, BarChart3, CalendarRange, Sparkles, Waypoints } from 'lucide-react'
import { TrackLink } from '@/components/track-link'
import { site } from '@/lib/site'

const foundations = [
  { icon: Waypoints, label: 'Connect', copy: 'Bring your social destinations into one workspace.' },
  { icon: Sparkles, label: 'Create', copy: 'Build posts and AI-assisted creative with a controlled workflow.' },
  { icon: CalendarRange, label: 'Schedule', copy: 'Plan single posts or build an entire publishing schedule.' },
  { icon: BarChart3, label: 'Analyse', copy: 'See performance and publishing activity without changing tools.' },
]

export default function HomePage() {
  return (
    <>
      <section className="hero section">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="container-shell hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">INXSocial · Intelligent social publishing</span>
            <h1>Turn one content workflow into <span>consistent social growth.</span></h1>
            <p>Plan, create, schedule and analyse content across your connected social destinations from one focused workspace.</p>
            <div className="hero-actions">
              <TrackLink className="button button-primary button-large" href={site.registerUrl} eventName="hero_trial_click">
                Start free trial <ArrowRight aria-hidden="true" />
              </TrackLink>
              <TrackLink className="button button-secondary button-large" href="#product" eventName="hero_product_click">See how it works</TrackLink>
            </div>
            <div className="hero-proof" aria-label="Trial highlights">
              <span>7-day trial</span><span>2 accounts</span><span>20 AI credits</span><span>No card required</span>
            </div>
          </div>

          <div className="hero-product" aria-label="INXSocial product foundation preview">
            <div className="product-window">
              <div className="window-top"><span/><span/><span/><b>INXSocial workspace</b></div>
              <div className="window-body">
                <aside><i/><i/><i/><i/><i/></aside>
                <div className="window-content">
                  <div className="kpi-row"><i/><i/><i/></div>
                  <div className="preview-grid">
                    <div className="preview-main"><span/><span/><span/><span/></div>
                    <div className="preview-side"><span/><span/><span/></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="floating-chip chip-one">9 social networks</div>
            <div className="floating-chip chip-two">AI Content Studio</div>
          </div>
        </div>
      </section>

      <section className="section foundation-section" id="product">
        <div className="container-shell">
          <div className="section-heading">
            <span className="eyebrow">Phase 1 foundation</span>
            <h2>A cleaner system for every part of the product story.</h2>
            <p>This new marketing layer is built around reusable components, responsive rules, accessible interaction, SEO metadata and conversion analytics.</p>
          </div>
          <div className="foundation-grid">
            {foundations.map(({ icon: Icon, label, copy }) => (
              <article className="foundation-card" key={label}>
                <span className="icon-box"><Icon aria-hidden="true" /></span>
                <h3>{label}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section phase-banner" id="ai-studio">
        <div className="container-shell phase-banner-inner">
          <div>
            <span className="eyebrow">Foundation ready for Phase 2</span>
            <h2>The design system is now ready for the full homepage build.</h2>
          </div>
          <TrackLink className="button button-secondary" href={site.appUrl} eventName="foundation_app_click">Open INXSocial <ArrowRight aria-hidden="true" /></TrackLink>
        </div>
      </section>
    </>
  )
}
