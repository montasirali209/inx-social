import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.inxsocial.co.uk"),
  title: "INXSocial | Create, Schedule, Analyse & Manage Social Media",
  description: "Manage connected social accounts, create content with AI, bulk schedule campaigns, plan your calendar and analyse performance from one INXSocial workspace.",
  authors: [{ name: "INAXX LTD" }],
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
  icons: { icon: "/assets/inx-social-logo.png" },
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "INXSocial",
    title: "INXSocial — Create, Schedule, Analyse & Manage Social Media",
    description: "One connected workspace for social publishing, bulk scheduling, content planning, analytics and AI-assisted creation.",
    url: "https://www.inxsocial.co.uk/",
    images: [{ url: "/assets/inx-social-dashboard.jpg", alt: "INXSocial social media management workspace" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "INXSocial — Social Media Management + AI Content",
    description: "Create, schedule, manage and analyse social content from one workspace.",
    images: ["/assets/inx-social-dashboard.jpg"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061a24"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className="js">
      <body>{children}</body>
    </html>
  );
}
