'use client'

import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { primaryNav, site } from '@/lib/site'
import { TrackLink } from './track-link'

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="container-shell header-inner">
        <TrackLink className="brand" href="/" eventName="brand_home_click" aria-label="INXSocial home">
          <img className="brand-wordmark" src="https://social.inaxx.co.uk/assets/inx-social-wordmark.png" alt="" width="148" height="38" />
        </TrackLink>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {primaryNav.map((item) => (
            <TrackLink key={item.href} href={item.href} eventName="nav_click" eventData={{ label: item.label }}>
              {item.label}
            </TrackLink>
          ))}
        </nav>

        <div className="header-actions">
          <TrackLink className="text-link desktop-only" href={site.appUrl} eventName="login_click">Sign in</TrackLink>
          <TrackLink className="button button-primary desktop-only" href={site.registerUrl} eventName="header_trial_click">Start free trial</TrackLink>
          <button
            className="menu-button"
            type="button"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-nav" id="mobile-navigation">
          <div className="container-shell mobile-nav-inner">
            {primaryNav.map((item) => (
              <TrackLink key={item.href} href={item.href} eventName="mobile_nav_click" eventData={{ label: item.label }} onClick={() => setOpen(false)}>
                {item.label}
              </TrackLink>
            ))}
            <TrackLink href={site.appUrl} eventName="login_click">Sign in</TrackLink>
            <TrackLink className="button button-primary" href={site.registerUrl} eventName="mobile_trial_click">Start free trial</TrackLink>
          </div>
        </div>
      )}
    </header>
  )
}
