import { apiRequest } from './api-client'
import { plans } from '../data/billingData'
import type { BillingCycle, BillingOverview, PlanId } from '../types/billing'

export function getBillingOverview() { return apiRequest<BillingOverview>('/api/billing/overview') }
export async function changePlan(plan: Exclude<PlanId, 'trial'>, billingCycle: Exclude<BillingCycle, 'trial'>) {
  if (billingCycle !== 'monthly') throw new Error('Yearly billing is not available yet.')
  return apiRequest<{ url: string }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan: plan.toUpperCase() }) })
}
export async function openStripeCustomerPortal() { return apiRequest<{ url: string }>('/api/billing/portal', { method: 'POST', body: '{}' }) }
export async function updateBillingPreferences(settings: { productUpdates: boolean; usageLimitAlerts: boolean }) {
  const response = await apiRequest<{ preferences: typeof settings }>('/api/billing/preferences', { method: 'PUT', body: JSON.stringify(settings) })
  return response.preferences
}
export async function getPlans() { return plans }
export async function getUsage() { return (await getBillingOverview()).usage }
export async function getInvoices() { return (await getBillingOverview()).invoices }
export const cancelSubscription = openStripeCustomerPortal
export function deleteAccount(password: string) {
  return apiRequest<{ deleted: boolean; message: string }>('/api/portal/account', { method: 'DELETE', body: JSON.stringify({ password, confirmation: 'DELETE' }) })
}
