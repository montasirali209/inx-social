import { site } from '@/lib/site'

export function ProductJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: site.url,
    description: site.description,
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '18.99',
      highPrice: '99.99',
      priceCurrency: 'GBP',
      offerCount: '4',
    },
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
