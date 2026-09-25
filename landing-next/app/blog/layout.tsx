import type { Metadata } from "next";
import Link from "next/link";
import "./blog.css";

export const metadata: Metadata = {
  title: "INXSocial Blog | Social Media, AI Content & Growth",
  description:
    "Practical guides on social media management, AI content creation, scheduling, analytics and digital growth from INXSocial.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    type: "website",
    url: "https://www.inxsocial.co.uk/blog",
    title: "INXSocial Blog | Social Media, AI Content & Growth",
    description:
      "Practical guides on social media management, AI content creation, scheduling, analytics and digital growth from INXSocial.",
  },
};

export default function BlogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="inx-blog-page">
      <header className="inx-blog-header">
        <div className="inx-blog-header-inner">
          <Link className="inx-blog-brand" href="/" aria-label="INXSocial home">
            <img src="/assets/inx-social-wordmark-small.webp" width="168" height="56" alt="INXSocial" />
          </Link>
          <nav aria-label="Blog navigation">
            <Link href="/blog">Blog</Link>
            <Link href="/#capabilities">Product</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link className="inx-blog-header-cta" href="/portal/register.html">
              Start free trial
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="inx-blog-footer">
        <div className="inx-blog-footer-inner">
          <div>
            <strong>INXSocial</strong>
            <p>Create, schedule, analyse and grow from one connected workspace.</p>
          </div>
          <div className="inx-blog-footer-links">
            <Link href="/">Home</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/privacy.html">Privacy</Link>
            <Link href="/terms.html">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
