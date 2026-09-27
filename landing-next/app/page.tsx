import fs from "node:fs";
import path from "node:path";
import Script from "next/script";
import MotionLayer from "@/components/MotionLayer";
import { getVideoModelShowcase, homepageModelShowcaseMarkup } from "@/lib/video-model-showcase";

export const revalidate = 300;

export default async function HomePage() {
  const sourceMarkup = fs.readFileSync(path.join(process.cwd(), "public", "landing-body.html"), "utf8");
  const showcase = await getVideoModelShowcase(8);
  const landingMarkup = sourceMarkup.replace("<!--VIDEO_MODEL_SHOWCASE-->", homepageModelShowcaseMarkup(showcase));
  const schema = fs.readFileSync(path.join(process.cwd(), "public", "schema.json"), "utf8");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
      <div id="production-landing-parity" dangerouslySetInnerHTML={{ __html: landingMarkup }} />
      <MotionLayer />
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}
