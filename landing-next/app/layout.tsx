import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.inxsocial.co.uk"),
  applicationName: "INXSocial",
  title: "Social Media Scheduler & AI Content Studio | INXSocial",
  description: "Create, bulk schedule and analyse social media from one workspace. Plan content in a visual calendar and create images, carousels and short video with AI.",
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
    title: "Social Media Scheduler & AI Content Studio | INXSocial",
    description: "Create, schedule and analyse social content across connected accounts, with bulk scheduling, a visual calendar and AI-assisted creation in one workspace.",
    url: "https://www.inxsocial.co.uk/",
    images: [{
      url: "/assets/landing-dashboard-20260919.webp",
      width: 1200,
      height: 675,
      type: "image/webp",
      alt: "INXSocial social media scheduling and analytics dashboard"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Social Media Scheduler & AI Content Studio | INXSocial",
    description: "Create, bulk schedule and analyse social content from one connected workspace.",
    images: ["/assets/landing-dashboard-20260919.webp"]
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
