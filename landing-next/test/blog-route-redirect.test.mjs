import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = fs.readFileSync(path.join(here, "..", "next.config.ts"), "utf8");

test("plural blog aliases permanently redirect to the canonical singular route", () => {
  assert.match(config, /source: "\/blogs"[\s\S]*destination: "\/blog"[\s\S]*permanent: true/);
  assert.match(config, /source: "\/blogs\/:path\*"[\s\S]*destination: "\/blog\/:path\*"[\s\S]*permanent: true/);
});
