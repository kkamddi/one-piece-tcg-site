import { spawn } from "child_process";
import fs from "fs";
import http from "http";
import net from "net";
import os from "os";
import path from "path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const defaultProfile = path.join(os.tmpdir(), "optcg-psa-collector-profile");
let chromeStderr = "";

const PSA_TARGETS = [
  {
    cardId: "JP::P-046",
    cardNo: "P-046",
    locale: "JP",
    name: "Yamato",
    specUrl: "https://www.psacard.com/spec/psa/9555289",
  },
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  })
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getArg(name, fallback) {
  return args.has(name) ? args.get(name) : fallback;
}

function parseUsd(value) {
  const match = String(value || "").match(/(?:US\s*)?\$\s*([\d,]+(?:\.\d+)?)/i);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const ymd = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const mdy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return "";
}

function inferPlatform(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("ebay")) return "eBay";
  if (text.includes("goldin")) return "Goldin";
  if (text.includes("heritage")) return "Heritage";
  if (text.includes("pwcc")) return "PWCC";
  if (text.includes("psa")) return "PSA";
  return "PSA";
}

function parseSalesFromRows(rows = []) {
  const sales = [];
  for (const row of rows) {
    const joined = [...(row.cells || []), ...(row.links || []).map((link) => `${link.text} ${link.href}`)].join(" ");
    const priceUsd = parseUsd(joined);
    if (!priceUsd) continue;
    const soldAt =
      normalizeDate(joined) ||
      normalizeDate((row.cells || []).find((cell) => /\d{4}|\bJan\b|\bFeb\b|\bMar\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b/i.test(cell)));
    if (!soldAt) continue;
    const link = (row.links || []).find((item) => /ebay|auction|price|sale|sold/i.test(`${item.text} ${item.href}`));
    sales.push({
      soldAt,
      priceUsd,
      platform: inferPlatform(joined),
      source: "psa_visible_page",
      title: (row.cells || []).find((cell) => !/\$|20\d{2}|\d{1,2}[-/.]\d{1,2}/.test(cell)) || "",
      sourceUrl: link?.href || "",
      rawText: joined.slice(0, 500),
    });
  }
  return sales.sort((a, b) => String(b.soldAt).localeCompare(String(a.soldAt)));
}

function parseSalesFromText(text = "") {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sales = [];
  for (let i = 0; i < lines.length; i += 1) {
    const grade = lines[i];
    const platform = lines[i + 1] || "";
    const dateText = lines[i + 2] || "";
    const priceText = lines[i + 3] || "";
    if (!/^PSA\s*10$/i.test(grade)) continue;
    const soldAt = normalizeDate(dateText);
    const priceUsd = parseUsd(priceText);
    if (!soldAt || !priceUsd) continue;
    sales.push({
      soldAt,
      priceUsd,
      platform: inferPlatform(platform),
      source: "psa_visible_page",
      title: "",
      sourceUrl: "",
      rawText: [grade, platform, dateText, priceText].join(" | "),
    });
    i += 3;
  }
  return sales.sort((a, b) => String(b.soldAt).localeCompare(String(a.soldAt)) || b.priceUsd - a.priceUsd);
}

function parseSalesFromApi(api = {}) {
  const rows = api?.salesHistory?.json?.sales;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => Number(row.gradeValue) === 10 && Number(row.salePrice) > 0 && row.saleDate)
    .map((row) => ({
      soldAt: String(row.saleDate).slice(0, 10),
      priceUsd: Number(row.salePrice),
      platform: row.auctionHouse || inferPlatform(row.listingURL),
      source: "psa_sales_history_api",
      title: "",
      sourceUrl: row.listingURL || "",
      saleType: row.saleType || "",
      saleItemId: row.saleItemId || "",
      certNumber: row.certNumber || "",
      imageUrl: row.imageURL || "",
      thumbnailUrl: row.thumbnailURL || "",
      rawText: JSON.stringify(row).slice(0, 700),
    }))
    .sort((a, b) => String(b.soldAt).localeCompare(String(a.soldAt)) || b.priceUsd - a.priceUsd);
}

function makeTargetsFromArgs() {
  const queuePath = getArg("queue", "");
  if (queuePath) {
    const queuePayload = JSON.parse(fs.readFileSync(path.resolve(queuePath), "utf8"));
    const limit = Number(getArg("limit", 50));
    const offset = Number(getArg("offset", 0));
    return (queuePayload.queue || [])
      .filter((item) => item.psaSpecUrl && item.collectStatus === "ready")
      .slice(offset, offset + limit)
      .map((item) => ({
        cardId: item.cardId,
        cardNo: item.cardNo,
        locale: item.locale,
        name: item.name,
        specUrl: item.psaSpecUrl,
      }));
  }
  const url = getArg("url", "");
  if (!url) return PSA_TARGETS;
  return [
    {
      cardId: getArg("card-id", "JP::P-046"),
      cardNo: getArg("card-no", "P-046"),
      locale: getArg("locale", "JP"),
      name: getArg("name", ""),
      specUrl: url,
    },
  ];
}

function getJson(targetUrl) {
  return new Promise((resolve, reject) => {
    http
      .get(targetUrl, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function connectPage(port) {
  for (let i = 0; i < 80; i += 1) {
    try {
      await getJson(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await wait(250);
    }
  }
  const pages = await getJson(`http://127.0.0.1:${port}/json`);
  const page = pages.find((item) => item.type === "page") || pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let id = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const current = id++;
      pending.set(current, resolve);
      ws.send(JSON.stringify({ id: current, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  return { ws, send };
}

async function scrapeTarget(send, target, delayMs) {
  await send("Page.navigate", { url: target.specUrl });
  await wait(delayMs);

  const result = await send("Runtime.evaluate", {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < 8; i += 1) {
        window.scrollTo(0, document.body.scrollHeight);
        await wait(450);
      }
      const text = document.body ? document.body.innerText : "";
      const rows = [];
      const tables = [...document.querySelectorAll("table")];
      for (const table of tables) {
        const headers = [...table.querySelectorAll("thead th, tr:first-child th, tr:first-child td")]
          .map((item) => item.innerText.trim())
          .filter(Boolean);
        for (const tr of [...table.querySelectorAll("tbody tr, tr")].slice(1)) {
          const cells = [...tr.querySelectorAll("td, th")].map((td) => td.innerText.trim()).filter(Boolean);
          const links = [...tr.querySelectorAll("a[href]")].map((a) => ({ text: a.innerText.trim(), href: a.href }));
          if (cells.length) rows.push({ headers, cells, links });
        }
      }
      const links = [...document.querySelectorAll("a[href]")]
        .map((a) => ({ text: a.innerText.trim(), href: a.href }))
        .filter((item) => /auction|ebay|price|sale|sold/i.test(item.text + " " + item.href))
        .slice(0, 200);
      const resources = performance.getEntriesByType("resource").map((item) => item.name).filter(Boolean).slice(-200);
      const api = {};
      const specId = location.pathname.match(/\\/spec\\/psa\\/(\\d+)/)?.[1]
        || location.pathname.match(/\\/auctionprices\\/.*\\/(\\d+)\\/?$/)?.[1];
      const salesApiUrl = specId ? "/api/psa/researchJourney/spec/" + specId + "/salesHistory?pn=1&ps=50&g=10&q=false&gt=ALL" : "";
      const priceSummaryUrl = specId ? "/api/psa/researchJourney/spec/" + specId + "/psa/priceSummary?salesSummaryType=GRADES&q=false&gt=ALL" : "";
      try {
        if (salesApiUrl) {
          const salesRes = await fetch(salesApiUrl, { credentials: "include" });
          api.salesHistory = { ok: salesRes.ok, status: salesRes.status, json: salesRes.ok ? await salesRes.json() : null };
        }
      } catch (error) {
        api.salesHistory = { ok: false, error: String(error) };
      }
      try {
        if (priceSummaryUrl) {
          const summaryRes = await fetch(priceSummaryUrl, { credentials: "include" });
          api.priceSummary = { ok: summaryRes.ok, status: summaryRes.status, json: summaryRes.ok ? await summaryRes.json() : null };
        }
      } catch (error) {
        api.priceSummary = { ok: false, error: String(error) };
      }
      return {
        url: location.href,
        title: document.title,
        text: text.slice(0, 12000),
        rows,
        links,
        resources,
        api,
        blocked: /access denied|just a moment|captcha|turnstile|verify you are human|보안 확인|봇이 아님|악의적인 봇/i.test(text)
      };
    })()`,
  });

  return {
    ...target,
    scrapedAt: new Date().toISOString(),
    ok: true,
    ...(result.result?.result?.value || {}),
  };
}

async function main() {
  const loginOnly = args.has("login");
  const port = await findFreePort();
  const profile = getArg("profile", defaultProfile);
  const outFile = getArg("out", path.join("tmp", "psa10-visible-history.json"));
  const delayMs = Number(getArg("delay-ms", 6500));
  const headless = getArg("headless", loginOnly ? "false" : "true") !== "false";

  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const chromeArgs = [
    headless ? "--headless=new" : "",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ].filter(Boolean);

  const chrome = spawn(chromePath, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", (chunk) => {
    chromeStderr += chunk.toString();
  });

  try {
    const { ws, send } = await connectPage(port);
    if (loginOnly) {
      await send("Page.navigate", { url: "https://www.psacard.com/" });
      console.log(`Chrome opened for PSA login/check. Profile: ${profile}`);
      console.log("After login/check, stop this process with Ctrl+C and run without --login.");
      await new Promise(() => {});
      return;
    }

    const targets = makeTargetsFromArgs();
    const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : [];
    const done = new Set(existing.filter((item) => item.ok).map((item) => item.cardId));
    const output = [...existing];

    for (const target of targets) {
      if (done.has(target.cardId)) continue;
      try {
        const item = await scrapeTarget(send, target, delayMs);
        const apiSales = parseSalesFromApi(item.api);
        item.sales = apiSales.length ? apiSales : [...parseSalesFromRows(item.rows), ...parseSalesFromText(item.text)];
        item.latestSale = item.sales[0] || null;
        output.push(item);
        fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
        console.log(`${item.cardId} rows=${item.rows?.length || 0} links=${item.links?.length || 0} sales=${item.sales?.length || 0} blocked=${item.blocked}`);
      } catch (error) {
        output.push({ ...target, scrapedAt: new Date().toISOString(), ok: false, error: String(error) });
        fs.writeFileSync(outFile, JSON.stringify(output, null, 2));
        console.log(`${target.cardId} failed ${String(error).slice(0, 120)}`);
      }
    }
    ws.close();
  } finally {
    if (!loginOnly) chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  if (chromeStderr) console.error(chromeStderr.slice(0, 1600));
  process.exit(1);
});
