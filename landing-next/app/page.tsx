import fs from "node:fs";
import path from "node:path";
import Script from "next/script";
import MotionLayer from "@/components/MotionLayer";

export default function HomePage() {
  const landingMarkup = fs.readFileSync(path.join(process.cwd(), "public", "landing-body.html"), "utf8");
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
