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
          <TrackLink href="/features" eventName="footer_nav_click">All features</TrackLink>
          <TrackLink href="/bulk-scheduler" eventName="footer_nav_click">Bulk Scheduler</TrackLink>
          <TrackLink href="/ai-content-studio" eventName="footer_nav_click">AI Content Studio</TrackLink>
          <TrackLink href="/analytics" eventName="footer_nav_click">Analytics</TrackLink>
          <TrackLink href="/connected-accounts" eventName="footer_nav_click">Connected Accounts</TrackLink>
        </div>

        <div className="footer-links">
          <strong>Scheduling</strong>
          <TrackLink href="/social-media-scheduler" eventName="footer_nav_click">Social media scheduler</TrackLink>
          <TrackLink href="/facebook-scheduler" eventName="footer_nav_click">Facebook scheduler</TrackLink>
          <TrackLink href="/instagram-scheduler" eventName="footer_nav_click">Instagram scheduler</TrackLink>
          <TrackLink href="/linkedin-scheduler" eventName="footer_nav_click">LinkedIn scheduler</TrackLink>
          <TrackLink href="/tiktok-scheduler" eventName="footer_nav_click">TikTok scheduler</TrackLink>
        </div>

        <div className="footer-links">
          <strong>Company</strong>
          <TrackLink href="/pricing" eventName="footer_nav_click">Pricing</TrackLink>
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
