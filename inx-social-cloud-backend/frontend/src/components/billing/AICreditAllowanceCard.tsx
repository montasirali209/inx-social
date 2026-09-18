import { useMutation, useQuery } from '@tanstack/react-query'
import { Coins, ExternalLink, Sparkles } from 'lucide-react'
import { getPlan } from '../../data/billingData'
import { createAICreditTopupCheckout, getAICreditPacks, getAIStudioAccess } from '../../lib/ai-content-studio-api'
import type { PlanId } from '../../types/billing'
import { Button, Card, ProgressBar } from './BillingPrimitives'

export function AICreditAllowanceCard({ currentPlan, onUpgrade, administrator = false }: { currentPlan: PlanId; onUpgrade: () => void; administrator?: boolean }) {
  const plan = getPlan(currentPlan)
  const access = useQuery({
    queryKey: ['ai-studio-access', 'billing'],
    queryFn: getAIStudioAccess,
    retry: false,
  })
  const packs = useQuery({
    queryKey: ['ai-credit-packs'],
    queryFn: getAICreditPacks,
    enabled: currentPlan !== 'trial' && !administrator,
    retry: false,
  })
  const checkout = useMutation({
    mutationFn: createAICreditTopupCheckout,
    onSuccess: ({ url }) => window.location.assign(url),
  })

  if (access.isLoading) return <Card className="border-brand-teal/20 bg-panel/55 p-5 sm:p-6"><div className="flex items-start gap-3"><Coins className="mt-0.5 size-5 text-brand-cyan" /><div><h2 className="font-semibold">{administrator ? 'Administrator AI Studio Credits' : `${plan.name} AI Studio Credits`}</h2><p className="mt-1 text-xs leading-5 text-text-muted">The AI wallet is available here without blocking the Billing page. The live balance will fill in when the account response arrives.</p></div></div></Card>

  if (access.isError || !access.data) {
    return <Card className="border-brand-amber/25 p-5"><div className="flex items-start gap-3"><Coins className="mt-0.5 size-5 text-brand-amber" /><div><h2 className="font-semibold">{administrator ? 'Administrator AI Studio Credits' : `${plan.name} AI Studio Credits`}</h2><p className="mt-1 text-xs leading-5 text-text-muted">{administrator ? `Administrator access receives an operational allowance of ${plan.monthlyAiCredits.toLocaleString()} shared AI credits per period.` : `Your ${plan.name} access includes ${plan.monthlyAiCredits.toLocaleString()} shared AI credits${currentPlan === 'trial' ? ' for this trial' : ' per billing period'}.`} The live balance could not be loaded right now.</p><Button className="mt-3" onClick={() => void access.refetch()}>Refresh balance</Button></div></div></Card>
  }

  const remaining = access.data.creditsRemaining ?? 0
  const limit = access.data.creditsLimit ?? plan.monthlyAiCredits
  const monthlyRemaining = access.data.monthlyRemaining ?? Math.min(remaining, limit)
  const topupRemaining = access.data.topupRemaining ?? Math.max(0, remaining - monthlyRemaining)
  const used = Math.max(0, limit - monthlyRemaining)
  const topupsSupported = !administrator && currentPlan !== 'trial' && Boolean(access.data.topupsEnabled && access.data.topupsSupported && packs.data?.supported && packs.data.packs.length)

  return <Card className="overflow-hidden border-brand-teal/25 bg-[radial-gradient(circle_at_92%_0%,rgba(34,211,238,.10),transparent_20rem),linear-gradient(145deg,rgba(6,37,45,.96),rgba(5,20,33,.98))] p-5 sm:p-6">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-cyan"><Sparkles className="size-4" />{administrator ? 'Administrator AI Studio Credits' : `${plan.name} AI Studio Credits`}</span><span className="rounded-full border border-brand-green/25 bg-brand-green/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-brand-green">Included</span></div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="text-3xl tracking-tight">{remaining.toLocaleString()}</strong><span className="text-xs text-text-muted">credits available</span></div>
        <div className="mt-4 max-w-2xl"><div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-text-muted"><span>{used.toLocaleString()} of {limit.toLocaleString()} included credits used</span><span>{monthlyRemaining.toLocaleString()} included remaining</span></div><ProgressBar label="AI Studio credit usage" max={limit} value={used} /></div>
        <div className="mt-4 grid gap-2 text-[11px] text-text-muted sm:grid-cols-2"><span>{currentPlan === 'trial' ? 'Trial allowance' : 'Monthly allowance'}: <b className="text-white">{limit.toLocaleString()}</b></span><span>Purchased top-ups: <b className="text-white">{topupRemaining.toLocaleString()}</b></span><span>Shared across: <b className="text-white">all AI Studio generation</b></span><span>Premium video models: <b className="text-white">use more credits</b></span></div>
      </div>
      <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
        <h3 className="text-xs font-semibold">One shared AI wallet</h3><p className="mt-2 text-[10px] leading-5 text-text-muted">Images, carousels, UGC, AI video and Stock Video Creator all use the same wallet. INXSocial reserves credits before generation and automatically returns them when a generation fails.</p>
        {administrator ? <div className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal/[.04] p-3"><p className="text-[10px] leading-4 text-text-muted">This is an internal administrator allowance, not a paid plan. Credit purchases are intentionally disabled for administrator accounts.</p></div> : topupsSupported ? <div className="mt-4"><p className="mb-2 text-[10px] font-semibold text-text-muted">Add one-time AI credits</p><div className="grid grid-cols-2 gap-2">{packs.data!.packs.map((pack) => <Button disabled={checkout.isPending} key={pack.credits} onClick={() => checkout.mutate(pack.credits)}>{pack.credits.toLocaleString()} credits</Button>)}</div>{checkout.isError && <p className="mt-2 text-[10px] text-brand-red">{checkout.error instanceof Error ? checkout.error.message : 'Credit checkout could not be opened.'}</p>}</div> : currentPlan === 'trial' ? <div className="mt-4 rounded-xl border border-brand-cyan/15 bg-brand-cyan/[.035] p-3"><p className="text-[10px] leading-4 text-text-muted">Trial includes the full AI Content Studio with 20 credits. Upgrade to a paid plan to unlock monthly allowances and one-time credit top-ups.</p><Button className="mt-3 w-full" onClick={onUpgrade}>View paid plans</Button></div> : <p className="mt-4 rounded-xl border border-border-soft bg-white/[.025] p-3 text-[10px] leading-4 text-text-muted">Extra top-ups will appear here as soon as Stripe confirms the available credit packs.</p>}
        {checkout.isPending && <span className="mt-3 flex items-center gap-2 text-[10px] text-text-muted"><ExternalLink className="size-3.5" />Opening secure Stripe Checkout…</span>}
      </div>
    </div>
  </Card>
}
