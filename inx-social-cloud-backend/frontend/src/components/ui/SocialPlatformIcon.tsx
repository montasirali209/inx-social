export type SocialPlatformName =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'pinterest'
  | 'x'
  | 'threads'
  | 'bluesky'
  | 'google_business'

const labels: Record<SocialPlatformName, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  x: 'X',
  threads: 'Threads',
  bluesky: 'Bluesky',
  google_business: 'Google Business',
}

const badgeStyles: Record<SocialPlatformName, string> = {
  facebook: 'bg-[#1877f2] text-white',
  instagram: 'bg-[radial-gradient(circle_at_30%_110%,#feda75_0%,#fa7e1e_28%,#d62976_52%,#962fbf_76%,#4f5bd5_100%)] text-white',
  linkedin: 'bg-[#0a66c2] text-white',
  youtube: 'bg-[#ff0000] text-white',
  tiktok: 'border border-white/15 bg-[#010101] text-white',
  pinterest: 'bg-[#e60023] text-white',
  x: 'border border-white/15 bg-[#050505] text-white',
  threads: 'border border-white/15 bg-[#101010] text-white',
  bluesky: 'bg-[#1185fe] text-white',
  google_business: 'border border-black/10 bg-white text-[#4285f4]',
}

function Glyph({ platform }: { platform: SocialPlatformName }) {
  if (platform === 'facebook') {
    return <svg aria-hidden="true" className="size-[62%]" viewBox="0 0 24 24"><path d="M13.7 22v-8.1h2.72l.41-3.16H13.7V8.72c0-.91.25-1.54 1.57-1.54h1.68V4.36c-.29-.04-1.29-.13-2.45-.13-2.42 0-4.08 1.48-4.08 4.2v2.31H7.68v3.16h2.74V22h3.28Z" fill="currentColor" /></svg>
  }
  if (platform === 'instagram') {
    return <svg aria-hidden="true" className="size-[64%]" fill="none" viewBox="0 0 24 24"><rect height="15.5" rx="4.5" stroke="currentColor" strokeWidth="2.1" width="15.5" x="4.25" y="4.25" /><circle cx="12" cy="12" r="3.65" stroke="currentColor" strokeWidth="2.1" /><circle cx="17.45" cy="6.75" fill="currentColor" r="1.05" /></svg>
  }
  if (platform === 'linkedin') {
    return <svg aria-hidden="true" className="size-[62%]" viewBox="0 0 24 24"><path d="M6.4 8.1H3.2V20h3.2V8.1ZM4.8 3A1.85 1.85 0 1 0 4.8 6.7 1.85 1.85 0 0 0 4.8 3Zm8.05 5.1H9.78V20h3.2v-5.88c0-1.55.3-3.05 2.22-3.05 1.9 0 1.92 1.78 1.92 3.15V20h3.2v-6.51c0-3.2-.69-5.67-4.43-5.67-1.8 0-3 .99-3.49 1.92h-.04V8.1Z" fill="currentColor" /></svg>
  }
  if (platform === 'youtube') {
    return <svg aria-hidden="true" className="size-[68%]" viewBox="0 0 24 24"><path d="M21.2 7.2a2.72 2.72 0 0 0-1.92-1.93C17.59 4.8 12 4.8 12 4.8s-5.59 0-7.28.47A2.72 2.72 0 0 0 2.8 7.2 28.4 28.4 0 0 0 2.33 12c0 1.62.15 3.22.47 4.8a2.72 2.72 0 0 0 1.92 1.93c1.69.47 7.28.47 7.28.47s5.59 0 7.28-.47a2.72 2.72 0 0 0 1.92-1.93c.32-1.58.47-3.18.47-4.8 0-1.62-.15-3.22-.47-4.8ZM10.06 15.08V8.92L15.4 12l-5.34 3.08Z" fill="currentColor" /></svg>
  }
  if (platform === 'tiktok') {
    return <svg aria-hidden="true" className="size-[65%]" viewBox="0 0 24 24"><path d="M14.8 3.2c.23 1.9 1.3 3.34 3.2 4.12v2.53a8.24 8.24 0 0 1-3.18-.92v5.58a5.38 5.38 0 1 1-4.64-5.33v2.72a2.72 2.72 0 1 0 1.94 2.61V3.2h2.68Z" fill="#25f4ee" transform="translate(-.45 .35)" /><path d="M14.8 3.2c.23 1.9 1.3 3.34 3.2 4.12v2.53a8.24 8.24 0 0 1-3.18-.92v5.58a5.38 5.38 0 1 1-4.64-5.33v2.72a2.72 2.72 0 1 0 1.94 2.61V3.2h2.68Z" fill="#fe2c55" transform="translate(.42 -.2)" /><path d="M14.8 3.2c.23 1.9 1.3 3.34 3.2 4.12v2.53a8.24 8.24 0 0 1-3.18-.92v5.58a5.38 5.38 0 1 1-4.64-5.33v2.72a2.72 2.72 0 1 0 1.94 2.61V3.2h2.68Z" fill="white" /></svg>
  }
  if (platform === 'pinterest') {
    return <svg aria-hidden="true" className="size-[66%]" viewBox="0 0 24 24"><path d="M12 2.3a9.7 9.7 0 0 0-3.53 18.74c-.08-.83-.15-2.1.03-3 .2-.81 1.25-5.3 1.25-5.3s-.32-.64-.32-1.58c0-1.48.86-2.59 1.93-2.59.91 0 1.35.69 1.35 1.51 0 .91-.58 2.28-.88 3.55-.25 1.06.53 1.93 1.58 1.93 1.89 0 3.35-2 3.35-4.88 0-2.55-1.84-4.34-4.46-4.34-3.03 0-4.81 2.28-4.81 4.63 0 .92.35 1.9.79 2.44.09.1.1.2.07.31l-.3 1.21c-.04.2-.15.24-.35.14-1.33-.62-2.16-2.57-2.16-4.13 0-3.37 2.44-6.46 7.05-6.46 3.7 0 6.58 2.64 6.58 6.17 0 3.68-2.32 6.64-5.53 6.64-1.08 0-2.1-.56-2.45-1.23l-.67 2.54c-.24.93-.89 2.09-1.33 2.8.99.3 2.04.47 3.13.47A9.7 9.7 0 1 0 12 2.3Z" fill="currentColor" /></svg>
  }
  if (platform === 'x') {
    return <svg aria-hidden="true" className="size-[58%]" viewBox="0 0 24 24"><path d="M4.5 4h4.2l3.93 5.24L17.25 4H20l-6.12 7.13L20.3 20h-4.2l-4.2-5.65L7 20H4.25l6.38-7.54L4.5 4Zm3.05 1.7 9.4 12.6h1.8L9.35 5.7h-1.8Z" fill="currentColor" /></svg>
  }
  if (platform === 'threads') {
    return <svg aria-hidden="true" className="size-[66%]" fill="none" viewBox="0 0 24 24"><path d="M17.7 10.6c-.26-4.15-2.36-6.43-5.92-6.43-4.1 0-6.53 2.9-6.53 7.73 0 5.03 2.52 7.93 6.93 7.93 3.48 0 5.72-1.78 5.72-4.55 0-2.4-1.7-3.95-4.3-3.95-2.5 0-4.17 1.25-4.17 3.13 0 1.57 1.18 2.55 2.97 2.55 2.95 0 4.85-2.47 4.85-6.15 0-3.08-1.35-5.12-4.25-5.12-2.25 0-3.78 1.18-4.35 3.18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" /></svg>
  }
  if (platform === 'bluesky') {
    return <svg aria-hidden="true" className="size-[67%]" viewBox="0 0 24 24"><path d="M12 10.8c-.85-1.66-3.17-4.76-5.33-6.33C4.6 2.98 3.8 3.23 3.28 3.47c-.6.27-.78 1.2-.78 1.75 0 .55.3 4.52.5 5.18.66 2.2 3 2.94 5.15 2.56-3.74.65-7.06 2.24-2.7 7.08 4.8 4.96 6.58-1.06 7.1-2.74.52 1.68 1.89 7.58 7 2.74 3.84-3.84 1.05-6.43-2.69-7.08 2.15.38 4.49-.36 5.15-2.56.2-.66.5-4.63.5-5.18 0-.55-.18-1.48-.78-1.75-.52-.24-1.32-.49-3.39 1-2.16 1.57-4.48 4.67-5.33 6.33Z" fill="currentColor" /></svg>
  }
  return <svg aria-hidden="true" className="size-[64%]" viewBox="0 0 24 24"><path d="M21 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.04a4.3 4.3 0 0 1-1.87 2.82v2.51h3.03c1.77-1.72 2.8-4.26 2.8-7.15Z" fill="#4285F4" /><path d="M12 22c2.52 0 4.64-.88 6.2-2.62l-3.03-2.51c-.84.6-1.91.96-3.17.96-2.43 0-4.49-1.74-5.23-4.08H3.64v2.59A9.65 9.65 0 0 0 12 22Z" fill="#34A853" /><path d="M6.77 13.75A6.2 6.2 0 0 1 6.45 12c0-.61.11-1.2.32-1.75V7.66H3.64A10.22 10.22 0 0 0 2.6 12c0 1.56.37 3.04 1.04 4.34l3.13-2.59Z" fill="#FBBC05" /><path d="M12 6.17c1.37 0 2.6.5 3.57 1.48l2.67-2.81C16.63 3.25 14.52 2 12 2a9.65 9.65 0 0 0-8.36 5.66l3.13 2.59C7.51 7.91 9.57 6.17 12 6.17Z" fill="#EA4335" /></svg>
}

export function SocialPlatformIcon({ platform, className = '' }: { platform: SocialPlatformName; className?: string }) {
  return (
    <span
      aria-label={labels[platform]}
      className={`inline-grid size-6 shrink-0 place-items-center overflow-hidden rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_4px_12px_rgba(0,0,0,.18)] ring-1 ring-white/10 ${badgeStyles[platform]} ${className}`}
      role="img"
      title={labels[platform]}
    >
      <Glyph platform={platform} />
    </span>
  )
}
