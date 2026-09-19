import { site } from '@/lib/site'
import { TrackLink } from './track-link'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-shell footer-grid">
        <div>
          <div className="brand footer-brand"><span className="brand-mark">IX</span><span className="brand-name">INX<span>Social</span></span></div>
          <p>One intelligent workspace for creating, scheduling and analysing social content.</p>
        </div>
        <div className="footer-links">
          <strong>Product</strong>
          <TrackLink href="/#product" eventName="footer_nav_click">Product</TrackLink>
          <TrackLink href="/#ai-studio" eventName="footer_nav_click">AI Content Studio</TrackLink>
          <TrackLink href="/pricing" eventName="footer_nav_click">Pricing</TrackLink>
        </div>
        <div className="footer-links">
          <strong>Company</strong>
          <TrackLink href="/privacy" eventName="footer_nav_click">Privacy</TrackLink>
          <TrackLink href="/terms" eventName="footer_nav_click">Terms</TrackLink>
          <a href={`mailto:${site.supportEmail}`}>Contact</a>
        </div>
      </div>
      <div className="container-shell footer-bottom">© 2026 {site.company}. All rights reserved.</div>
    </footer>
  )
}
