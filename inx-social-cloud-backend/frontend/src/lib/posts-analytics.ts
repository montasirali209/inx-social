import type { FacebookAnalytics } from '../types/dashboard'
import type { BestTimeInsight } from '../types/posts'

function formatHour(hour: number) {
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' }).format(new Date(2025, 0, 1, hour, 0))
}

export function calculateBestPostTime(analytics: FacebookAnalytics | null | undefined): BestTimeInsight {
  if (!analytics?.content.length) return { available: false, label: 'Analytics recommendation', time: null, detail: 'Publish more content to unlock a personalised recommendation.' }
  const buckets = new Map<number, { score: number; posts: number }>()
  for (const item of analytics.content) {
    if (!item.createdTime) continue
    const date = new Date(item.createdTime)
    if (Number.isNaN(date.getTime())) continue
    const hour = date.getHours()
    const engagement = item.insights?.totalInteractions ?? (item.reactions + item.comments + item.shares)
    const bucket = buckets.get(hour) || { score: 0, posts: 0 }
    bucket.score += Math.max(0, engagement)
    bucket.posts += 1
    buckets.set(hour, bucket)
  }
  if (!buckets.size) return { available: false, label: 'Analytics recommendation', time: null, detail: 'There is not enough time-based Page activity yet.' }
  const [hour, evidence] = [...buckets.entries()].sort((left, right) => {
    const leftScore = left[1].score / Math.sqrt(left[1].posts)
    const rightScore = right[1].score / Math.sqrt(right[1].posts)
    return rightScore - leftScore || right[1].posts - left[1].posts
  })[0]
  return {
    available: true,
    label: `Around ${formatHour(hour)}`,
    time: `${String(hour).padStart(2, '0')}:00`,
    detail: `Based on ${evidence.posts} published post${evidence.posts === 1 ? '' : 's'} and live engagement from ${analytics.page.name}.`,
  }
}
