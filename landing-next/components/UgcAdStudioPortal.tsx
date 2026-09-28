"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import UgcAdStudioShowcase from "@/components/UgcAdStudioShowcase";
import { WEBSITE_MEDIA, websiteMediaPath } from "@/lib/website-media";

export default function UgcAdStudioPortal() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById("ugc-ad-studio-showcase-root"));
  }, []);

  if (!target) return null;

  return createPortal(
    <UgcAdStudioShowcase
      activeVideo={{
        name: "Maya",
        category: "Lifestyle Creator",
        videoSrc: websiteMediaPath(WEBSITE_MEDIA.landingUgcMayaVideo)
      }}
      creators={[
        {
          name: "Chloe",
          category: "Beauty & Skincare",
          videoSrc: websiteMediaPath(WEBSITE_MEDIA.landingUgcChloeVideo)
        },
        {
          name: "Sofia",
          category: "Fitness Creator",
          videoSrc: websiteMediaPath(WEBSITE_MEDIA.landingUgcSofiaVideo)
        },
        {
          name: "Emma",
          category: "Tech & Gadgets",
          videoSrc: websiteMediaPath(WEBSITE_MEDIA.landingUgcEmmaVideo)
        },
        {
          name: "Lily",
          category: "Home & Living",
          videoSrc: websiteMediaPath(WEBSITE_MEDIA.landingUgcLilyVideo)
        }
      ]}
    />,
    target
  );
}
