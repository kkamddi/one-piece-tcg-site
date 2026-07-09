import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

function loadEnvFile(filePath = ".env.local") {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return;
  const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim();
  }
}

function getArg(name, fallback) {
  return args.has(name) ? args.get(name) : fallback;
}

function runNode(scriptPath, scriptArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(scriptPath)} exited with ${code}`));
    });
    child.on("error", reject);
  });
}

async function postJson(apiUrl, token, payload) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items: payload }),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`history ingest failed ${response.status}: ${JSON.stringify(json).slice(0, 500)}`);
  }
  return json;
}

async function main() {
  loadEnvFile();
  const token = String(process.env.MARKET_COLLECTOR_TOKEN || getArg("token", "")).trim();
  if (!token) {
    throw new Error("MARKET_COLLECTOR_TOKEN is required");
  }

  const apiUrl = String(
    getArg("api-url", "https://www.optcgkorea.com/api/market-collector?mode=history"),
  );
  const explicitOutFile = getArg("out", "");
  const baseOffset = Number(getArg("offset", "0")) || 0;
  const limit = Math.max(1, Number(getArg("limit", "25")) || 25);
  const maxPages = Math.max(1, Number(getArg("max-pages", "1")) || 1);
  const apparelId = getArg("apparel-id", "");
  const apparelIds = getArg("apparel-ids", "");
  const profile = getArg("profile", "");
  const connectPort = getArg("connect-port", "");

  let uploadedItems = 0;
  const ingests = [];
  const pagesToRun = apparelId || apparelIds ? 1 : maxPages;
  for (let page = 0; page < pagesToRun; page += 1) {
    const offset = baseOffset + page * limit;
    const outFile = explicitOutFile || path.join("tmp", `snkrdunk-visible-history-${Date.now()}-${offset}.json`);
    const collectArgs = [
      `--out=${outFile}`,
      `--locale=${getArg("locale", "JP")}`,
      `--active-only=${getArg("active-only", "true")}`,
      `--offset=${offset}`,
      `--limit=${limit}`,
      `--delay-ms=${getArg("delay-ms", "3200")}`,
      `--headless=${getArg("headless", "true")}`,
    ];
    if (apparelId) collectArgs.push(`--apparel-id=${apparelId}`);
    if (apparelIds) collectArgs.push(`--apparel-ids=${apparelIds}`);
    if (profile) collectArgs.push(`--profile=${profile}`);
    if (connectPort) collectArgs.push(`--connect-port=${connectPort}`);

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    await runNode(path.join("scripts", "collect-snkrdunk-visible-history-cdp.js"), collectArgs);

    const payload = JSON.parse(fs.readFileSync(outFile, "utf8"));
    const result = await postJson(apiUrl, token, payload);
    const itemCount = Array.isArray(payload) ? payload.length : 1;
    uploadedItems += itemCount;
    ingests.push({ offset, limit, outFile, itemCount, result });
    if (!apparelId && !apparelIds && itemCount < limit) break;
  }

  console.log(JSON.stringify({
    ok: true,
    apiUrl,
    uploadedItems,
    pages: ingests.length,
    ingests,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
