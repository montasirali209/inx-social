import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WEBSITE_MEDIA, websiteMediaAbsoluteUrl, websiteMediaPath } from "@/lib/website-media";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.inxsocial.co.uk"),
  applicationName: "INXSocial",
  title: "AI Content, Video Studio & Social Publishing | INXSocial",
  description: "Create AI video with a multi-model Video Studio, campaigns, UGC, images and carousels, then schedule, publish and analyse social content in INXSocial.",
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
    title: "AI Content, Video Studio & Social Publishing | INXSocial",
    description: "Create AI video across a live multi-model catalogue, generate campaigns, UGC, images and carousels, then schedule, publish and analyse from one INXSocial workspace.",
    url: "https://www.inxsocial.co.uk/",
    images: [{
      url: websiteMediaAbsoluteUrl(WEBSITE_MEDIA.landingSocialPreview),
      secureUrl: websiteMediaAbsoluteUrl(WEBSITE_MEDIA.landingSocialPreview),
      width: 1200,
      height: 630,
      type: "image/jpeg",
      alt: "INXSocial AI content creation, multi-model Video Studio and social publishing platform"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Content, Video Studio & Social Publishing | INXSocial",
    description: "Create AI video, campaigns, UGC, images and carousels, then schedule, publish and analyse social content from one connected workspace.",
    images: [{
      url: websiteMediaAbsoluteUrl(WEBSITE_MEDIA.landingSocialPreview),
      alt: "INXSocial AI content creation, multi-model Video Studio and social publishing platform"
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
          href={websiteMediaPath(WEBSITE_MEDIA.landingHeroDashboard)}
          fetchPriority="high"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
