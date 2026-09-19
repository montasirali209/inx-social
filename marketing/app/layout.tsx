import type { Metadata, Viewport } from 'next'
import { Suspense, type ReactNode } from 'react'
import './globals.css'
import { PageAnalytics } from '@/components/page-analytics'
import { ProductJsonLd } from '@/components/json-ld'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { site } from '@/lib/site'

const indexable = process.env.NEXT_PUBLIC_INDEXABLE === 'true'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  title: {
    default: 'INXSocial — Social scheduling, analytics and AI content',
    template: '%s | INXSocial',
  },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: 'INXSocial — Create, schedule and grow from one workspace',
    description: site.description,
    url: site.url,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'INXSocial — Create, schedule and grow from one workspace',
    description: site.description,
  },
}

export const viewport: Viewport = {
  themeColor: '#04131e',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        <ProductJsonLd />
        <Suspense fallback={null}><PageAnalytics /></Suspense>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
