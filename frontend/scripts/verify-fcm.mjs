// verify-fcm.mjs — Verifies the FCM web-push pipeline BEFORE pushing (default:
// local build + server) and AFTER deploy (--live against production). Exits
// non-zero on any failed assertion so it can gate a commit.
//
//   node scripts/verify-fcm.mjs            # pre-push: build + local checks
//   node scripts/verify-fcm.mjs --live     # post-deploy: checks production
//
// What it proves:
//   1. The built bundle no longer calls the push endpoints directly against
//      the backend (the cause of the 404 + third-party cookie 401s).
//   2. The new code fetches them same-origin via the /api proxy.
//   3. The CSP allows firebaseinstallations/fcm.googleapis.com (getToken real).
//   4. /api/push/vapid-public-key returns 200 through the proxy (route exists).
import { spawn, execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const FRONTEND = resolve(import.meta.dirname, "..");
const PROD_URL = "https://hogwarts-nexus-lumiere.vercel.app";
const BACKEND = "https://nexus-backend-kkq8.onrender.com";
const LOCAL_PORT = 3100;

let failures = 0;
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok });
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function collectChunks(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectChunks(full, acc);
    else if (entry.isFile() && entry.name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

function scanChunkTexts(entries, label) {
  const texts = entries.map((e) => (typeof e.text === "string" ? e.text : readFileSync(e.path, "utf8")));
  const oldDirect = texts.filter((t) => t.includes(`${BACKEND}/api/push`)).length;
  const hasVapidSameOrigin = texts.some((t) =>
    t.includes("/api/push/vapid-public-key")
  );
  const hasFcmTokenSameOrigin = texts.some((t) => t.includes("/push/fcm-token"));
  check(
    `${label}: no direct backend calls for push endpoints`,
    oldDirect === 0,
    `${oldDirect} chunk(s) still call ${BACKEND}/api/push`
  );
  check(
    `${label}: same-origin VAPID fetch present`,
    hasVapidSameOrigin,
    "no chunk contains /api/push/vapid-public-key"
  );
  check(
    `${label}: same-origin fcm-token registration present`,
    hasFcmTokenSameOrigin,
    "no chunk contains /push/fcm-token"
  );
}

function checkCsp(csp, label) {
  check(
    `${label}: CSP allows firebaseinstallations`,
    csp.includes("firebaseinstallations.googleapis.com"),
    "connect-src missing firebaseinstallations.googleapis.com"
  );
  check(
    `${label}: CSP allows fcm.googleapis.com`,
    csp.includes("fcm.googleapis.com"),
    "connect-src missing fcm.googleapis.com"
  );
}

async function fetchWithRetry(url, opts = {}, attempts = 12, delayMs = 10000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, opts);
      return res;
    } catch (err) {
      lastErr = err;
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

function killTree(proc) {
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
    } catch {
      /* already dead */
    }
  } else {
    proc.kill("SIGKILL");
  }
}

async function waitForServer(url, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await sleep(1500);
  }
  return false;
}

async function verifyLocal() {
  console.log("== Build ==");
  const build = spawn("npx", ["next", "build"], {
    cwd: FRONTEND,
    stdio: "inherit",
    env: { ...process.env, API_PROXY_TARGET: BACKEND },
    shell: process.platform === "win32",
  });
  const buildCode = await new Promise((r) => build.on("close", r));
  if (buildCode !== 0) {
    check("next build succeeds", false, `exit code ${buildCode}`);
    process.exit(failures);
  }
  check("next build succeeds", true);

  console.log("== Static checks on .next/static ==");
  const chunks = collectChunks(join(FRONTEND, ".next", "static"));
  if (chunks.length === 0) {
    check("found built chunks", false, "no .js files under .next/static");
    process.exit(failures);
  }
  check("found built chunks", true);
  scanChunkTexts(chunks.map((path) => ({ path })), "local build");

  console.log("== Local server (proxy) checks ==");
  const server = spawn(
    "npx",
    ["next", "start", "-p", String(LOCAL_PORT)],
    {
      cwd: FRONTEND,
      stdio: "ignore",
      env: { ...process.env, API_PROXY_TARGET: BACKEND },
      shell: process.platform === "win32",
    }
  );
  try {
    const base = `http://localhost:${LOCAL_PORT}`;
    const up = await waitForServer(base);
    check("local server responds", up);
    if (!up) process.exit(failures);

    const home = await fetchWithRetry(`${base}/`, {}, 3, 3000);
    check(
      "local CSP header present",
      home.ok && Boolean(home.headers.get("content-security-policy")),
      `status ${home.status}`
    );
    checkCsp(home.headers.get("content-security-policy") || "", "local");

    const vapid = await fetchWithRetry(
      `${base}/api/push/vapid-public-key`,
      {},
      12,
      10000
    );
    check(
      "proxied /api/push/vapid-public-key returns 200",
      vapid.ok,
      `status ${vapid.status}`
    );
  } finally {
    killTree(server);
  }
}

async function verifyLive() {
  console.log("== Production checks ==");
  const home = await fetchWithRetry(`${PROD_URL}/`, {}, 3, 3000);
  check("production responds", home.ok, `status ${home.status}`);
  if (!home.ok) process.exit(failures);

  checkCsp(home.headers.get("content-security-policy") || "", "production");

  const html = await home.text();
  const scriptSrcs = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)]
    .map((m) => m[1])
    .concat(
      [...html.matchAll(/href="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(
        (m) => m[1]
      )
    );
  check("production HTML references chunks", scriptSrcs.length > 0);
  const chunkTexts = [];
  for (const src of scriptSrcs) {
    const res = await fetch(`${PROD_URL}${src}`);
    if (res.ok) chunkTexts.push({ name: src, text: await res.text() });
  }
  check("production chunks fetched", chunkTexts.length > 0);
  scanChunkTexts(chunkTexts, "production");

  const vapid = await fetchWithRetry(
    `${PROD_URL}/api/push/vapid-public-key`,
    {},
    12,
    10000
  );
  check(
    "production /api/push/vapid-public-key returns 200",
    vapid.ok,
    `status ${vapid.status}`
  );
}

const live = process.argv.includes("--live");
try {
  if (live) await verifyLive();
  else await verifyLocal();
} catch (err) {
  check("script ran without error", false, String(err));
}

console.log("");
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.error(`${failures} CHECK(S) FAILED`);
  process.exit(1);
}