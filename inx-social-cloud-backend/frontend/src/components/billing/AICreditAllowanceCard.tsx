import { useMutation, useQuery } from '@tanstack/react-query'
import { Coins, Crown, ExternalLink, Sparkles } from 'lucide-react'
import { createAICreditTopupCheckout, getAICreditPacks, getAIStudioAccess } from '../../lib/ai-content-studio-api'
import type { PlanId } from '../../types/billing'
import { Button, Card, ProgressBar } from './BillingPrimitives'

export function AICreditAllowanceCard({ currentPlan, onUpgrade }: { currentPlan: PlanId; onUpgrade: () => void }) {
  const access = useQuery({
    queryKey: ['ai-studio-access', 'billing'],
    queryFn: getAIStudioAccess,
    retry: false,
  })
  const packs = useQuery({
    queryKey: ['ai-credit-packs'],
    queryFn: getAICreditPacks,
    enabled: currentPlan === 'plus',
    retry: false,
  })
  const checkout = useMutation({
    mutationFn: createAICreditTopupCheckout,
    onSuccess: ({ url }) => window.location.assign(url),
  })

  if (currentPlan !== 'plus') {
    return <Card className="overflow-hidden border-brand-purple/20 bg-[radial-gradient(circle_at_88%_10%,rgba(139,92,246,.12),transparent_19rem),linear-gradient(145deg,rgba(9,28,44,.96),rgba(5,16,28,.98))] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-brand-purple/25 bg-brand-purple/10 text-[#c4b5fd]"><Sparkles className="size-5" /></span>
          <div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#c4b5fd]">Plus AI allowance</span><h2 className="mt-1 text-lg font-semibold">500 AI Studio credits every billing period</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-text-muted">AI Studio credits are used only for Image Posts, Carousels, Short Video / Reels and UGC Ad generation. Pro caption writing and enhancement do not use these credits.</p></div>
        </div>
        <Button className="w-full lg:w-auto" onClick={onUpgrade} tone="primary"><Crown className="size-4" />Upgrade to Plus</Button>
      </div>
    </Card>
  }

  if (access.isLoading) return <Card className="h-44 animate-pulse border-brand-teal/20 bg-panel/55"><span className="sr-only">Loading AI credit allowance</span></Card>

  if (access.isError || !access.data) {
    return <Card className="border-brand-amber/25 p-5"><div className="flex items-start gap-3"><Coins className="mt-0.5 size-5 text-brand-amber" /><div><h2 className="font-semibold">Plus AI Studio Credits</h2><p className="mt-1 text-xs leading-5 text-text-muted">Your Plus plan includes 500 AI Studio credits per billing period. The live balance could not be loaded right now.</p><Button className="mt-3" onClick={() => void access.refetch()}>Refresh balance</Button></div></div></Card>
  }

  const remaining = access.data.creditsRemaining ?? 0
  const limit = access.data.creditsLimit ?? 500
  const monthlyRemaining = access.data.monthlyRemaining ?? Math.min(remaining, limit)
  const topupRemaining = access.data.topupRemaining ?? Math.max(0, remaining - monthlyRemaining)
  const used = Math.max(0, limit - monthlyRemaining)
  const topupsSupported = Boolean(access.data.topupsSupported && packs.data?.supported && packs.data.packs.length)

  return <Card className="overflow-hidden border-brand-teal/25 bg-[radial-gradient(circle_at_92%_0%,rgba(34,211,238,.10),transparent_20rem),linear-gradient(145deg,rgba(6,37,45,.96),rgba(5,20,33,.98))] p-5 sm:p-6">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)] lg:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-cyan"><Crown className="size-4" />Plus AI Studio Credits</span><span className="rounded-full border border-brand-green/25 bg-brand-green/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-brand-green">Included</span></div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="text-3xl tracking-tight">{remaining.toLocaleString()}</strong><span className="text-xs text-text-muted">credits available</span></div>
        <div className="mt-4 max-w-2xl"><div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-text-muted"><span>{used.toLocaleString()} of {limit.toLocaleString()} monthly credits used</span><span>{monthlyRemaining.toLocaleString()} monthly remaining</span></div><ProgressBar label="Monthly AI Studio credit usage" max={limit} value={used} /></div>
        <div className="mt-4 grid gap-2 text-[11px] text-text-muted sm:grid-cols-2"><span>Monthly allowance: <b className="text-white">{limit.toLocaleString()}</b></span><span>Purchased top-ups: <b className="text-white">{topupRemaining.toLocaleString()}</b></span><span>Used only for: <b className="text-white">AI Content Studio</b></span><span>Caption AI: <b className="text-white">does not use credits</b></span></div>
      </div>
      <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
        <h3 className="text-xs font-semibold">How your allowance works</h3><p className="mt-2 text-[10px] leading-5 text-text-muted">Monthly credits refresh with your billing period. INXSocial spends the monthly allowance first, then purchased top-up credits. Failed generations are returned automatically.</p>
        {topupsSupported ? <div className="mt-4"><p className="mb-2 text-[10px] font-semibold text-text-muted">Add AI Studio credits</p><div className="grid grid-cols-2 gap-2">{packs.data!.packs.map((pack) => <Button disabled={checkout.isPending} key={pack.credits} onClick={() => checkout.mutate(pack.credits as 250 | 500 | 1000 | 2500)}>{pack.credits.toLocaleString()} credits</Button>)}</div>{checkout.isError && <p className="mt-2 text-[10px] text-brand-red">{checkout.error instanceof Error ? checkout.error.message : 'Credit checkout could not be opened.'}</p>}</div> : <p className="mt-4 rounded-xl border border-border-soft bg-white/[.025] p-3 text-[10px] leading-4 text-text-muted">Extra top-ups will appear here when Stripe top-up products are enabled. Your included 500-credit allowance works independently.</p>}
        {checkout.isPending && <span className="mt-3 flex items-center gap-2 text-[10px] text-text-muted"><ExternalLink className="size-3.5" />Opening secure Stripe Checkout…</span>}
      </div>
    </div>
  </Card>
}