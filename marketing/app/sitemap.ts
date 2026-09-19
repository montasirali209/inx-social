import type { MetadataRoute } from 'next'
import { acquisitionSlugs } from '@/lib/acquisition'
import { site } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const acquisition = acquisitionSlugs.map((slug) => ({
    url: `${site.url}/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: slug === 'social-media-scheduler' ? 0.95 : slug.endsWith('-scheduler') ? 0.82 : 0.9,
  }))

  return [
    { url: site.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/pricing`, lastModified: now, changeFrequency: 'weekly', priority: 0.95 },
    ...acquisition,
  ]
}
