import { site } from '@/lib/site'
import { TrackLink } from './track-link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-shell footer-grid footer-grid-phase-two">
        <div className="footer-intro">
          <div className="brand footer-brand"><span className="brand-mark">IX</span><span className="brand-name">INX<span>Social</span></span></div>
          <p>Create. Schedule. Analyse. Grow. One connected workspace for social publishing and AI-assisted content creation.</p>
          <span className="footer-company">A product by {site.company}</span>
        </div>
        <div className="footer-links">
          <strong>Product</strong>
          <TrackLink href="/#product" eventName="footer_nav_click">Capabilities</TrackLink>
          <TrackLink href="/#bulk-scheduler" eventName="footer_nav_click">Bulk Scheduler</TrackLink>
          <TrackLink href="/#ai-studio" eventName="footer_nav_click">AI Content Studio</TrackLink>
          <TrackLink href="/#analytics" eventName="footer_nav_click">Analytics</TrackLink>
        </div>
        <div className="footer-links">
          <strong>Explore</strong>
          <TrackLink href="/#platforms" eventName="footer_nav_click">Platforms</TrackLink>
          <TrackLink href="/#pricing" eventName="footer_nav_click">Pricing</TrackLink>
          <TrackLink href="/#faq" eventName="footer_nav_click">FAQ</TrackLink>
          <TrackLink href={site.appUrl} eventName="footer_nav_click">Open app</TrackLink>
        </div>
        <div className="footer-links">
          <strong>Company</strong>
          <a href="https://inaxx.co.uk/">INAXX LTD</a>
          <TrackLink href="/privacy" eventName="footer_nav_click">Privacy</TrackLink>
          <TrackLink href="/terms" eventName="footer_nav_click">Terms</TrackLink>
          <a href={`mailto:${site.supportEmail}`}>Contact</a>
        </div>
      </div>
      <div className="container-shell footer-bottom"><span>© 2026 {site.company}. All rights reserved.</span><span>INXSocial · United Kingdom</span></div>
    </footer>
  )
}
