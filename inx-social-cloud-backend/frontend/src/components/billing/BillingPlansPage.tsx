import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleHelp, ExternalLink, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { billingHelp, getPlan } from '../../data/billingData'
import { changePlan, deleteAccount, getBillingOverview, openStripeCustomerPortal, updateBillingPreferences } from '../../lib/billing-api'
import { useUiStore } from '../../store/ui-store'
import type { BillingCycle, PlanId } from '../../types/billing'
import { AICreditAllowanceCard } from './AICreditAllowanceCard'
import { AccountPrivacyCard, BillingInformationCard, ChangePlanSection, ComparisonTable, CurrentPlanCard, InvoicesCard, InvoiceRow, SecureBillingFooter, UsageCard, UsageDetails } from './BillingSections'
import { Button, Card, Drawer, Modal } from './BillingPrimitives'

type Panel = null | 'subscription' | 'usage' | 'invoices' | 'compare' | 'plan' | 'delete' | 'security'
type Notice = { tone: 'success' | 'error'; text: string } | null

function BillingSkeleton() { return <div aria-label="Loading billing details" className="grid animate-pulse gap-4 xl:grid-cols-12"><div className="h-72 rounded-panel border border-border-soft bg-panel/55 xl:col-span-8" /><div className="h-72 rounded-panel border border-border-soft bg-panel/55 xl:col-span-4" /><div className="h-48 rounded-panel border border-border-soft bg-panel/55 xl:col-span-7" /><div className="h-48 rounded-panel border border-border-soft bg-panel/55 xl:col-span-5" /><div className="h-[520px] rounded-panel border border-border-soft bg-panel/55 xl:col-span-12" /></div> }

export function BillingPlansPage() {
  const [checkoutResult] = useState(() => new URLSearchParams(window.location.search).get('checkout'))
  const [creditResult] = useState(() => new URLSearchParams(window.location.search).get('credits'))
  const queryClient = useQueryClient()
  const search = useUiStore((state) => state.billingSearch)
  const setSearch = useUiStore((state) => state.setBillingSearch)
  const helpOpen = useUiStore((state) => state.billingHelpOpen)
  const setHelpOpen = useUiStore((state) => state.setBillingHelpOpen)
  const [panel, setPanel] = useState<Panel>(null)
  const [cycle, setCycle] = useState<Exclude<BillingCycle, 'trial'>>('monthly')
  const [targetPlan, setTargetPlan] = useState<PlanId>('pro')
  const [highlightPlans, setHighlightPlans] = useState(false)
  const [notice, setNotice] = useState<Notice>(() => checkoutResult === 'success'
    ? { tone: 'success', text: 'Payment completed. Subscription status is refreshing.' }
    : checkoutResult === 'cancelled'
      ? { tone: 'error', text: 'Checkout was cancelled. No plan change was made.' }
      : creditResult === 'success'
        ? { tone: 'success', text: 'AI credit payment completed. Your balance is refreshing.' }
        : creditResult === 'cancelled'
          ? { tone: 'error', text: 'AI credit checkout was cancelled. No credits were added.' }
          : null)
  const [deleteText, setDeleteText] = useState('')
  const [password, setPassword] = useState('')
  const [openHelp, setOpenHelp] = useState<number | null>(0)
  const planSection = useRef<HTMLElement | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const overview = useQuery({ queryKey: ['billing-overview'], queryFn: getBillingOverview })

  function toast(next: Exclude<Notice, null>) {
    setNotice(next)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4500)
  }

  useEffect(() => {
    if (checkoutResult || creditResult) {
      window.history.replaceState({}, '', '/app/billing')
      void queryClient.invalidateQueries({ queryKey: ['billing-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['ai-studio-access'] })
      void queryClient.invalidateQueries({ queryKey: ['ai-credit-packs'] })
      noticeTimer.current = window.setTimeout(() => setNotice(null), 4500)
    }
    return () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current) }
  }, [checkoutResult, creditResult, queryClient])

  const preferences = useMutation({
    mutationFn: updateBillingPreferences,
    onSuccess: (value) => { queryClient.setQueryData(['billing-overview'], (current: typeof overview.data) => current ? { ...current, preferences: value } : current); toast({ tone: 'success', text: 'Billing preferences updated.' }) },
    onError: (error) => toast({ tone: 'error', text: error instanceof Error ? error.message : 'Preferences could not be saved.' }),
  })
  const checkout = useMutation({
    mutationFn: ({ plan, billingCycle }: { plan: Exclude<PlanId, 'trial'>; billingCycle: Exclude<BillingCycle, 'trial'> }) => changePlan(plan, billingCycle),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast({ tone: 'error', text: error instanceof Error ? error.message : 'Checkout could not be opened.' }),
  })
  const deletion = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: () => { window.localStorage.removeItem('inx-social-cloud-token'); window.localStorage.removeItem('inxToken'); window.location.assign('/portal/login.html') },
    onError: (error) => toast({ tone: 'error', text: error instanceof Error ? error.message : 'Account could not be deleted.' }),
  })

  async function portal() {
    try { const { url } = await openStripeCustomerPortal(); window.location.assign(url) }
    catch (error) { toast({ tone: 'error', text: error instanceof Error ? error.message : 'Stripe Customer Portal could not be opened.' }) }
  }
  function showPlans() {
    setHighlightPlans(true)
    planSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => setHighlightPlans(false), 2400)
  }
  function choosePlan(plan: PlanId) { setTargetPlan(plan); setPanel('plan') }
  function visible(...terms: string[]) { const query = search.trim().toLowerCase(); return !query || terms.join(' ').toLowerCase().includes(query) }

  if (overview.isLoading) return <BillingSkeleton />
  if (overview.isError || !overview.data) return <Card className="p-6"><TriangleAlert className="size-8 text-brand-red" /><h2 className="mt-3 text-lg font-semibold">Billing details are unavailable</h2><p className="mt-2 text-sm text-text-muted">{overview.error instanceof Error ? overview.error.message : 'Please try again.'}</p><Button className="mt-4" onClick={() => void overview.refetch()}>Try again</Button></Card>

  const data = overview.data
  const currentPlan = getPlan(data.subscription.planId)
  const target = getPlan(targetPlan)
  const currentRank = { trial: 0, pro: 1, plus: 2 }[data.subscription.planId]
  const targetRank = { trial: 0, pro: 1, plus: 2 }[targetPlan]
  const isUpgrade = targetRank > currentRank
  const targetPrice = cycle === 'yearly' ? target.yearlyPrice : target.monthlyPrice

  return <div className="space-y-4 pb-10">
    <div className="grid gap-2 sm:hidden"><label className="relative"><span className="sr-only">Search billing</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input className="min-h-11 w-full rounded-xl border border-border-soft bg-panel/70 pl-10 pr-3 text-sm outline-none focus:border-brand-cyan" onChange={(event) => setSearch(event.target.value)} placeholder="Search billing…" type="search" value={search} /></label><Button onClick={() => setHelpOpen(true)}><CircleHelp className="size-4" />Billing Help</Button></div>
    {search && !['current plan subscription upgrade usage ai credits allowance topup billing information payment stripe invoice change plan compare account privacy product updates delete secure'].some((term) => visible(term)) && <Card className="p-8 text-center"><h2 className="font-semibold">No billing sections found</h2><p className="mt-2 text-sm text-text-muted">Try a different search term.</p></Card>}
    <div className="grid items-stretch gap-4 xl:grid-cols-12">
      {visible('current plan subscription upgrade manage') && <div className="xl:col-span-7"><CurrentPlanCard onManage={() => setPanel('subscription')} onUpgrade={showPlans} overview={data} /></div>}
      {visible('usage limits analytics ai scheduled connected pages') && <div className="xl:col-span-5"><UsageCard onView={() => setPanel('usage')} overview={data} /></div>}
    </div>
    {visible('ai studio credits allowance plus topup generation') && <AICreditAllowanceCard currentPlan={data.subscription.planId} onUpgrade={showPlans} />}
    {visible('billing information payment method stripe security') && <BillingInformationCard onUpdate={() => void portal()} />}
    {visible('change plan trial pro plus upgrade downgrade compare pricing monthly yearly') && <section ref={planSection}><ChangePlanSection availability={data.billing.availability} current={data.subscription.planId} cycle={cycle} highlight={highlightPlans} onChoose={choosePlan} onCompare={() => setPanel('compare')} onCycle={setCycle} /></section>}
    <div className="grid items-stretch gap-4 xl:grid-cols-12">
      {visible('invoices download pdf paid upcoming failed refunded') && <div className="xl:col-span-5"><InvoicesCard invoices={data.invoices} onViewAll={() => setPanel('invoices')} /></div>}
      {visible('account privacy product updates usage alerts delete') && <div className="xl:col-span-7"><AccountPrivacyCard onDelete={() => setPanel('delete')} onProduct={(value) => preferences.mutate({ ...data.preferences, productUpdates: value })} onUsage={(value) => preferences.mutate({ ...data.preferences, usageLimitAlerts: value })} productUpdates={data.preferences.productUpdates} saving={preferences.isPending} usageAlerts={data.preferences.usageLimitAlerts} /></div>}
    </div>
    {visible('secure billing stripe payment privacy') && <SecureBillingFooter onLearn={() => setPanel('security')} />}

    <Modal footer={<><Button onClick={() => setPanel(null)}>Close</Button>{data.subscription.canManage && <Button onClick={() => void portal()} tone="primary"><ExternalLink className="size-4" />Open Stripe Customer Portal</Button>}</>} onClose={() => setPanel(null)} open={panel === 'subscription'} title="Manage Subscription"><div className="space-y-4"><div className="rounded-xl border border-border-soft bg-bg/35 p-4"><div className="flex items-center justify-between"><span className="text-sm text-text-muted">Current plan</span><strong>{currentPlan.name}</strong></div><div className="mt-3 flex items-center justify-between"><span className="text-sm text-text-muted">Billing cycle</span><strong className="capitalize">{data.subscription.legacyLifetime ? 'Legacy lifetime' : data.subscription.billingCycle}</strong></div><div className="mt-3 flex items-center justify-between"><span className="text-sm text-text-muted">Next payment / end date</span><strong>{data.subscription.renewalDate ? new Date(data.subscription.renewalDate).toLocaleDateString('en-GB') : 'None'}</strong></div></div><p className="text-sm leading-6 text-text-muted">Plan changes, cancellation, invoices and payment methods are managed securely by Stripe. Stripe shows any proration and effective date before you confirm.</p>{!data.subscription.canManage && <p className="rounded-xl border border-brand-amber/25 bg-brand-amber/8 p-3 text-sm text-[#fbbf24]">There is no paid Stripe subscription to manage. Choose Pro or Plus below to start one.</p>}</div></Modal>
    <Drawer footer={<Button onClick={() => setPanel(null)}>Close</Button>} onClose={() => setPanel(null)} open={panel === 'usage'} title="Usage Details"><UsageDetails overview={data} /></Drawer>
    <Modal footer={<Button onClick={() => setPanel(null)}>Close</Button>} onClose={() => setPanel(null)} open={panel === 'invoices'} title="All Invoices">{data.invoices.length ? <div className="overflow-hidden rounded-xl border border-border-soft">{data.invoices.map((invoice) => <InvoiceRow invoice={invoice} key={invoice.id} />)}</div> : <p className="text-sm text-text-muted">No invoices are available yet.</p>}</Modal>
    <Modal footer={<Button onClick={() => setPanel(null)}>Close comparison</Button>} onClose={() => setPanel(null)} open={panel === 'compare'} title="Compare Plans"><ComparisonTable /></Modal>
    <Modal footer={<><Button disabled={checkout.isPending} onClick={() => setPanel(null)}>Cancel</Button><Button disabled={checkout.isPending || targetPlan === 'trial'} onClick={() => targetPlan !== 'trial' && (data.subscription.canManage ? void portal() : checkout.mutate({ plan: targetPlan, billingCycle: cycle }))} tone="primary">{checkout.isPending ? 'Opening Stripe…' : `${isUpgrade ? 'Confirm Upgrade' : 'Continue with'} ${target.name}`}</Button></>} onClose={() => setPanel(null)} open={panel === 'plan'} title={`${isUpgrade ? 'Upgrade' : 'Change'} to ${target.name}`}><div className="space-y-4"><div className="grid gap-3 rounded-xl border border-border-soft bg-bg/35 p-4 sm:grid-cols-2"><div><span className="text-xs text-text-muted">Current plan</span><strong className="mt-1 block">{currentPlan.name}</strong></div><div><span className="text-xs text-text-muted">New plan</span><strong className="mt-1 block text-brand-cyan">{target.name}</strong></div><div><span className="text-xs text-text-muted">New price</span><strong className="mt-1 block">£{targetPrice?.toFixed(2)} / {cycle === 'yearly' ? 'year' : 'month'}</strong></div><div><span className="text-xs text-text-muted">Effective date</span><strong className="mt-1 block">{data.subscription.canManage ? 'Shown in Stripe Portal' : 'After checkout'}</strong></div></div><p className="text-sm leading-6 text-text-muted">{data.subscription.canManage ? 'Stripe Customer Portal will show the final prorated amount and effective date before you approve the change.' : 'Stripe Checkout will collect payment securely. INXSocial never sees or stores your raw card details.'}</p>{!isUpgrade && <div className="rounded-xl border border-brand-amber/25 bg-brand-amber/8 p-3"><strong className="text-sm text-[#fbbf24]">Features changing</strong><p className="mt-1 text-xs text-text-muted">A lower plan may remove Analytics, caption assistance or full AI Content Studio access at the effective date shown by Stripe.</p></div>}</div></Modal>
    <Modal footer={<><Button disabled={deletion.isPending} onClick={() => setPanel(null)}>Cancel</Button><Button disabled={deleteText !== 'DELETE' || !password || deletion.isPending} onClick={() => deletion.mutate()} tone="danger">{deletion.isPending ? 'Deleting…' : 'Delete my account'}</Button></>} onClose={() => setPanel(null)} open={panel === 'delete'} title="Delete INXSocial account"><div className="space-y-4"><div className="rounded-xl border border-brand-red/30 bg-brand-red/8 p-4"><TriangleAlert className="size-6 text-brand-red" /><p className="mt-2 text-sm leading-6">This permanently removes your account data, disconnects connected social accounts and cancels linked Stripe subscriptions. This cannot be undone.</p></div><label className="block text-xs font-semibold text-text-muted">Type DELETE to confirm<input autoComplete="off" className="mt-2 min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm outline-none focus:border-brand-red" onChange={(event) => setDeleteText(event.target.value)} value={deleteText} /></label><label className="block text-xs font-semibold text-text-muted">Current password<input autoComplete="current-password" className="mt-2 min-h-11 w-full rounded-xl border border-border-soft bg-bg/45 px-3 text-sm outline-none focus:border-brand-red" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label></div></Modal>
    <Modal footer={<Button onClick={() => setPanel(null)}>Close</Button>} onClose={() => setPanel(null)} open={panel === 'security'} title="Stripe Billing Security"><div className="space-y-3 text-sm leading-6 text-text-muted"><p><b className="text-white">Stripe handles payment details.</b> Payment-method updates and subscription management happen on Stripe-hosted pages.</p><p>INXSocial does not store raw card numbers and does not display card details, billing addresses or Stripe customer identifiers.</p><p>Stripe Customer Portal shows the final effects of plan changes, cancellation dates and any applicable proration before confirmation.</p></div></Modal>
    <Drawer footer={<Button onClick={() => setHelpOpen(false)}>Close help</Button>} onClose={() => setHelpOpen(false)} open={helpOpen} title="Billing Help"><div className="space-y-2">{billingHelp.map(([question, answer], index) => <div className="rounded-xl border border-border-soft bg-bg/30" key={question}><button aria-expanded={openHelp === index} className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand-cyan" onClick={() => setOpenHelp(openHelp === index ? null : index)} type="button">{question}<span className="text-brand-cyan">{openHelp === index ? '−' : '+'}</span></button>{openHelp === index && <p className="border-t border-border-soft px-4 py-3 text-sm leading-6 text-text-muted">{answer}</p>}</div>)}</div></Drawer>
    {notice && <div aria-live="polite" className={`fixed bottom-5 right-5 z-[120] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${notice.tone === 'success' ? 'border-brand-teal/35 bg-[#08251f]/95' : 'border-brand-red/35 bg-[#30131b]/95'}`}><span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${notice.tone === 'success' ? 'bg-brand-teal' : 'bg-brand-red'}`}>{notice.tone === 'success' ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}</span><span>{notice.text}</span><button aria-label="Dismiss notification" className="ml-auto text-text-muted" onClick={() => setNotice(null)} type="button">×</button></div>}
  </div>
}
