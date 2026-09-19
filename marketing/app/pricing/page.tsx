import type { Metadata } from 'next'
import { ArrowRight, Check, Minus } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { TrackLink } from '@/components/track-link'
import { plans } from '@/lib/product'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Pricing — Creator, Pro, Business and Agency',
  description: 'Compare INXSocial Trial, Creator, Pro, Business and Agency plans, connected-account limits, AI credits, scheduling, analytics and support.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    title: 'INXSocial pricing',
    description: 'Compare connected-account capacity, AI credits and support across INXSocial plans.',
    url: `${site.url}/pricing`,
  },
}

const comparison = [
  ['Connected accounts', '2', '5', '12', '25', '50'],
  ['Published posts', '50 during Trial', 'Unlimited', 'Unlimited', 'Unlimited', 'Unlimited'],
  ['Scheduling', true, true, true, true, true],
  ['Bulk Scheduler', true, true, true, true, true],
  ['Full Analytics', true, true, true, true, true],
  ['AI caption assistance', true, true, true, true, true],
  ['AI Content Studio', true, true, true, true, true],
  ['AI credits', '20 once', '150 / month', '500 / month', '1,200 / month', '2,500 / month'],
  ['Stock Video Creator', 'Uses AI credits', 'Uses AI credits', 'Uses AI credits', 'Uses AI credits', 'Uses AI credits'],
  ['Support', 'Standard', 'Standard', 'Priority', 'Priority', 'Priority+'],
] as const

const pricingFaqs = [
  ['How does the Trial work?', 'The seven-day Trial includes two connected accounts, up to 50 published posts, scheduling, Bulk Scheduler, Full Analytics, AI caption assistance and 20 one-time AI credits. No card is required to start.'],
  ['What happens to monthly AI credits?', 'Monthly plan credits refresh each billing period. Purchased top-up credits are kept separately and are used after the monthly allowance.'],
  ['Can I buy extra AI credits?', 'Yes. Paid plans can purchase one-time AI credit packs from Billing & Plans when top-ups are enabled in production.'],
  ['Are posts unlimited on paid plans?', 'Yes. Creator, Pro, Business and Agency include unlimited posts and scheduling. Connected-account capacity and AI-credit allowance vary by plan.'],
  ['How are payments managed?', 'Checkout, payment-method changes, invoices and subscription management are handled through Stripe. INXSocial does not display full card details.'],
] as const

function planHref(id: string) {
  if (id === 'trial') return site.registerUrl
  return `${site.registerUrl}?plan=${id.toUpperCase()}`
}

export default function PricingPage() {
  return (
    <>
      <PricingSchema />

      <section className="section pricing-page-hero">
        <div className="container-shell">
          <Reveal className="section-heading centered">
            <span className="eyebrow">INXSocial pricing</span>
            <h1 className="page-title">Start with the whole workflow. Scale the capacity when you need it.</h1>
            <p>Scheduling, Bulk Scheduler, Full Analytics, AI caption assistance and AI Content Studio are included from the Trial onward. Paid plans increase connected-account capacity, AI credits and support.</p>
          </Reveal>

          <Reveal className="pricing-trial-hero" delay={50}>
            <div>
              <span className="trial-badge">7-day Trial</span>
              <h2>Try the real product before choosing a paid plan.</h2>
              <p>2 connected accounts · 50 published posts · scheduling & Bulk Scheduler · Full Analytics · 20 one-time AI credits · no card required</p>
            </div>
            <TrackLink className="button button-primary button-large" href={site.registerUrl} eventName="pricing_page_trial_click">
              Start free trial <ArrowRight aria-hidden="true" />
            </TrackLink>
          </Reveal>

          <div className="pricing-page-grid">
            {plans.filter((plan) => plan.id !== 'trial').map((plan, index) => (
              <Reveal className={`price-card pricing-page-card ${plan.featured ? 'featured' : ''}`} delay={index * 45} key={plan.id}>
                {plan.featured && <span className="popular-badge">Most popular</span>}
                <span className="plan-eyebrow">{plan.eyebrow}</span>
                <h2>{plan.name}</h2>
                <div className="plan-price"><sup>£</sup><strong>{plan.price.toFixed(2)}</strong><span>/ month</span></div>
                <ul>
                  <li><Check /> Up to {plan.accounts} connected accounts</li>
                  <li><Check /> Unlimited posts & scheduling</li>
                  <li><Check /> Bulk Scheduler + Full Analytics</li>
                  <li><Check /> All AI caption assistance</li>
                  <li><Check /> Full AI Content Studio</li>
                  <li><Check /> {plan.credits.toLocaleString()} AI credits / month</li>
                  <li><Check /> {plan.support}</li>
                </ul>
                <TrackLink className={`button ${plan.featured ? 'button-primary' : 'button-secondary'}`} href={planHref(plan.id)} eventName="pricing_page_plan_click" eventData={{ plan: plan.name }}>
                  Choose {plan.name}
                </TrackLink>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section comparison-section">
        <div className="container-shell">
          <Reveal className="section-heading centered compact-heading">
            <span className="eyebrow">Plan comparison</span>
            <h2>Compare the limits that actually change.</h2>
            <p>The core product stays consistent. Capacity, AI allowance and support scale with the plan.</p>
          </Reveal>
          <Reveal className="comparison-wrap" delay={60}>
            <table className="comparison-table">
              <thead><tr><th>Feature</th>{plans.map((plan) => <th key={plan.id}>{plan.name}</th>)}</tr></thead>
              <tbody>
                {comparison.map(([label, ...values]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    {values.map((value, index) => <td key={index}>{typeof value === 'boolean' ? (value ? <Check className="table-check" aria-label="Included" /> : <Minus aria-label="Not included" />) : value}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      <section className="section credit-explainer-section">
        <div className="container-shell credit-explainer-grid">
          <Reveal>
            <span className="eyebrow">AI credit economics</span>
            <h2>One shared wallet across AI Content Studio.</h2>
            <p>Image, carousel, AI video, UGC and Stock Video Creator workflows draw from the same AI-credit balance. The app shows a credit estimate before generation, and higher-cost video models consume more credits than economical routes.</p>
          </Reveal>
          <Reveal className="credit-stack" delay={60}>
            {plans.map((plan) => <div key={plan.id}><span>{plan.name}</span><strong>{plan.credits.toLocaleString()}</strong><small>{plan.id === 'trial' ? 'one-time credits' : 'credits / month'}</small></div>)}
          </Reveal>
        </div>
      </section>

      <section className="section acquisition-faq">
        <div className="container-shell faq-grid">
          <Reveal className="faq-intro">
            <span className="eyebrow">Billing questions</span>
            <h2>Know exactly what changes when you upgrade.</h2>
            <p>INXSocial keeps plan capacity separate from the core publishing workflow so the product does not become fragmented across tiers.</p>
          </Reveal>
          <Reveal className="faq-list" delay={60}>
            {pricingFaqs.map(([question, answer], index) => <details className="faq-item" key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
          </Reveal>
        </div>
      </section>
    </>
  )
}

function PricingSchema() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: site.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: site.url,
        offers: plans.filter((plan) => plan.id !== 'trial').map((plan) => ({
          '@type': 'Offer',
          name: `${site.name} ${plan.name}`,
          price: plan.price.toFixed(2),
          priceCurrency: 'GBP',
          url: `${site.url}/pricing`,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: pricingFaqs.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
