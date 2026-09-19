import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AcquisitionPage } from '@/components/acquisition-page'
import { acquisitionPages, acquisitionSlugs } from '@/lib/acquisition'
import { site } from '@/lib/site'

export function generateStaticParams() {
  return acquisitionSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = acquisitionPages[slug]
  if (!page) return {}

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: 'website',
      title: page.title,
      description: page.description,
      url: `${site.url}/${page.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
  }
}

export default async function AcquisitionRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = acquisitionPages[slug]
  if (!page) notFound()
  return <AcquisitionPage page={page} />
}
