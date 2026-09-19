import type { Metadata } from 'next'
import { site } from '@/lib/site'
import { TrackLink } from '@/components/track-link'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Compare INXSocial Creator, Pro, Business and Agency plans.',
  alternates: { canonical: '/pricing' },
}

const plans = [
  ['Creator', '£18.99', '5 accounts', '150 AI credits'],
  ['Pro', '£34.99', '12 accounts', '500 AI credits'],
  ['Business', '£59.99', '25 accounts', '1,200 AI credits'],
  ['Agency', '£99.99', '50 accounts', '2,500 AI credits'],
] as const

export default function PricingPage() {
  return <section className="section"><div className="container-shell">
    <div className="section-heading centered"><span className="eyebrow">Pricing</span><h1 className="page-title">Scale the allowance, not the complexity.</h1><p>Every paid plan includes scheduling, Bulk Scheduler, analytics, AI caption assistance and AI Content Studio.</p></div>
    <div className="pricing-grid">{plans.map(([name, price, accounts, credits], index) => <article className={`price-card ${index===1?'featured':''}`} key={name}><span className="eyebrow">{index===1?'Most popular':'INXSocial'}</span><h2>{name}</h2><strong>{price}<small>/month</small></strong><p>{accounts}</p><p>{credits}</p><TrackLink className="button button-primary" href={site.registerUrl} eventName="pricing_plan_click" eventData={{ plan: name }}>Choose {name}</TrackLink></article>)}</div>
  </div></section>
}
