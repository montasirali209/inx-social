type ProductShotProps = {
  src: string
  alt: string
  label: string
  caption?: string
  eager?: boolean
  className?: string
}

export function ProductShot({ src, alt, label, caption, eager = false, className = '' }: ProductShotProps) {
  return (
    <figure className={`product-shot ${className}`}>
      <div className="product-shot-chrome" aria-hidden="true">
        <span className="shot-dots"><i /><i /><i /></span>
        <strong>{label}</strong>
        <span className="shot-live"><i /> Live product UI</span>
      </div>
      <div className="product-shot-media">
        <img
          src={src}
          alt={alt}
          width="1280"
          height="860"
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
        />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

export const productShots = {
  dashboard: '/product/inxsocial-dashboard-real.webp',
  bulk: '/product/inxsocial-bulk-real.webp',
  analytics: '/product/inxsocial-analytics-real.webp',
  ai: '/product/inxsocial-ai-studio-real.webp',
} as const
