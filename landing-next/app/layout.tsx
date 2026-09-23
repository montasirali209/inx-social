import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.inxsocial.co.uk"),
  applicationName: "INXSocial",
  title: "Social Media Management Platform, Scheduler & AI | INXSocial",
  description: "Create, bulk schedule and analyse social media in one workspace with AI campaigns, UGC video, image-to-video, Smart Timing and multi-platform publishing.",
  authors: [{ name: "INAXX LTD", url: "https://inaxx.co.uk/" }],
  creator: "INAXX LTD",
  publisher: "INAXX LTD",
  category: "software",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  alternates: {
    canonical: "https://www.inxsocial.co.uk/",
    languages: {
      "en-GB": "https://www.inxsocial.co.uk/",
      "x-default": "https://www.inxsocial.co.uk/"
    }
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: "/assets/inx-social-logo.png",
    apple: "/assets/inx-social-logo.png"
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "INXSocial",
    title: "Social Media Management Platform, Scheduler & AI | INXSocial",
    description: "Create campaigns, UGC video, image-to-video and social posts, then bulk schedule with Smart Timing and analyse performance from one INXSocial workspace.",
    url: "https://www.inxsocial.co.uk/",
    images: [{
      url: "https://www.inxsocial.co.uk/assets/inxsocial-social-preview-v3.jpg",
      secureUrl: "https://www.inxsocial.co.uk/assets/inxsocial-social-preview-v3.jpg",
      width: 1200,
      height: 630,
      type: "image/jpeg",
      alt: "INXSocial social media management platform homepage with dashboard preview"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Media Management Platform, Scheduler & AI | INXSocial",
    description: "Create AI campaigns and social content, bulk schedule with Smart Timing, and analyse results from one connected workspace.",
    images: [{
      url: "https://www.inxsocial.co.uk/assets/inxsocial-social-preview-v3.jpg",
      alt: "INXSocial social media management platform homepage with dashboard preview"
    }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061a24",
  colorScheme: "dark light"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className="js">
      <head>
        <link
          rel="preload"
          as="image"
          href="/assets/landing-dashboard-20260919.webp"
          type="image/webp"
          fetchPriority="high"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
