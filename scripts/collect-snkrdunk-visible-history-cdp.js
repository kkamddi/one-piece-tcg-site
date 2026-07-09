import { spawn } from "child_process";
import fs from "fs";
import http from "http";
import net from "net";
import os from "os";
import path from "path";
import marketCards from "../src/data/market-cards.js";

const chromePathCandidates = [
  process.env.CHROME_PATH,
  process.env.GOOGLE_CHROME_SHIM,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

function resolveChromePath() {
  for (const candidate of chromePathCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return chromePathCandidates[0] || "google-chrome";
}

const chromePath = resolveChromePath();
const defaultProfile = path.join(os.tmpdir(), "optcg-snkrdunk-collector-profile");
let chromeStderr = "";

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

function writeJsonFile(filePath, value) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2));
  fs.renameSync(tmpPath, filePath);
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

function parsePriceText(priceText) {
  const value = String(priceText || "").match(/[\d,]+/);
  return value ? Number(value[0].replace(/,/g, "")) : null;
}

function makeTargets() {
  const apparelId = getArg("apparel-id", "");
  const apparelIds = String(getArg("apparel-ids", ""))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const locale = getArg("locale", "JP");
  const activeOnly = getArg("active-only", "true") !== "false";
  const offset = Number(getArg("offset", 0));
  const limit = Number(getArg("limit", 25));

  let targets = marketCards
    .filter((item) => item.locale === locale && item.apparelId)
    .filter((item) => !activeOnly || Number(item.listingCount || 0) > 0);
  if (apparelId) {
    targets = targets.filter((item) => String(item.apparelId) === String(apparelId));
  } else if (apparelIds.length) {
    const targetIds = new Set(apparelIds.map(String));
    targets = targets.filter((item) => targetIds.has(String(item.apparelId)));
    const foundIds = new Set(targets.map((item) => String(item.apparelId)));
    for (const id of apparelIds) {
      if (!foundIds.has(String(id))) {
        targets.push({
          apparelId: Number(id),
          code: "",
          locale,
          name: "",
          setName: "",
          minPrice: null,
          listingCount: null,
          sourceUrl: `https://snkrdunk.com/en/trading-cards/${id}?slide=right`,
        });
      }
    }
  } else {
    targets = targets.slice(offset, offset + limit);
  }
  return targets
    .map((item) => ({
      apparelId: item.apparelId,
      code: item.code,
      locale: item.locale,
      name: item.name,
      setName: item.setName,
      minPrice: item.minPrice,
      listingCount: item.listingCount,
      sourceUrl: item.sourceUrl,
    }));
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
  const url = `https://snkrdunk.com/en/trading-cards/${target.apparelId}?slide=right`;
  await send("Page.navigate", { url });
  await wait(delayMs);

  const result = await send("Runtime.evaluate", {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      function parseTransform(value) {
        const match = String(value || "").match(/translate\\(([-\\d.]+),\\s*([-\\d.]+)\\)/);
        return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
      }
      function captureChart(conditionLabel) {
        const chartSvg = document.querySelector("svg.highcharts-root");
        const graphPath = chartSvg && chartSvg.querySelector("path.highcharts-graph");
        const seriesGroup = chartSvg && chartSvg.querySelector("g.highcharts-series");
        const xLabels = chartSvg
          ? Array.from(chartSvg.querySelectorAll(".highcharts-xaxis-labels text")).map((item) => ({
              text: item.textContent.trim(),
              x: Number(item.getAttribute("x")),
              y: Number(item.getAttribute("y")),
            })).filter((item) => item.text)
          : [];
        const yLabels = chartSvg
          ? Array.from(chartSvg.querySelectorAll(".highcharts-yaxis-labels text")).map((item) => ({
              text: item.textContent.trim(),
              x: Number(item.getAttribute("x")),
              y: Number(item.getAttribute("y")),
            })).filter((item) => item.text)
          : [];
        return graphPath ? {
          condition: conditionLabel,
          type: "highcharts-svg-path",
          path: graphPath.getAttribute("d"),
          xLabels,
          yLabels,
          seriesTranslate: parseTransform(seriesGroup && seriesGroup.getAttribute("transform")),
          width: Number(chartSvg.getAttribute("width")),
          height: Number(chartSvg.getAttribute("height")),
        } : null;
      }
      async function captureConditionCharts() {
        const labels = ["All", "A", "PSA 10"];
        const charts = {};
        for (const label of labels) {
          const button = Array.from(document.querySelectorAll(".sales-chart .condition-tab"))
            .find((item) => item.textContent.trim() === label);
          if (button) {
            button.click();
            await wait(900);
          }
          const chart = captureChart(label);
          if (chart) charts[label] = chart;
        }
        return charts;
      }
      const text = document.body ? document.body.innerText : "";
      const lines = text.split("\\n").map((line) => line.trim()).filter(Boolean);
      const historyStart = lines.findIndex((line) => /Trading History/i.test(line));
      const history = [];
      if (historyStart >= 0) {
        for (let i = historyStart + 1; i < Math.min(lines.length, historyStart + 140); i += 1) {
          const line = lines[i];
          const next = lines[i + 1] || "";
          if (/Price Chart/i.test(line)) break;
          if (/^[A-Z][a-z]{2}\\s+\\d+(st|nd|rd|th),\\s+\\d{4}$/.test(line) && /(US\\s*\\$|¥|JPY)/.test(next)) {
            const parts = next.split("\\t");
            if (parts.length >= 2) {
              history.push({ date: line, condition: parts[0].trim(), priceText: parts.slice(1).join(" ").trim() });
            } else {
              const matched = next.match(/^(A|B|C|D|PSA\\s*10|PSA\\s*9|PSA\\s*8\\s*or\\s*under|BGS[^\\t]+|ARS[^\\t]+|Other\\s*Graded)\\s+(.+)$/i);
              history.push({ date: line, condition: matched ? matched[1].trim() : "", priceText: matched ? matched[2].trim() : next });
            }
            i += 1;
          }
        }
      }
      const charts = await captureConditionCharts();
      const defaultChart = charts.All || null;
      const titleLine = lines.find((line) => /\\[[A-Z0-9-]+\\]|Box/i.test(line)) || document.title;
      return {
        url: location.href,
        title: document.title,
        titleLine,
        locked: /Sign up for free to view\\s*recent sales data/i.test(text),
        history,
        chart: defaultChart,
        charts,
      };
    })()`,
  });

  const value = result.result?.result?.value || {};
  return {
    ...target,
    scrapedAt: new Date().toISOString(),
    ok: true,
    pageTitle: value.title || "",
    pageTitleLine: value.titleLine || "",
    locked: Boolean(value.locked),
    history: (value.history || []).map((item) => ({
      ...item,
      priceUsd: parsePriceText(item.priceText),
    })),
    chart: value.chart || null,
    charts: value.charts || null,
  };
}

async function main() {
  const loginOnly = args.has("login");
  const connectPort = Number(getArg("connect-port", 0));
  const port = connectPort || (await findFreePort());
  const profile = getArg("profile", defaultProfile);
  const outFile = getArg("out", path.join("tmp", "snkrdunk-visible-history.json"));
  const delayMs = Number(getArg("delay-ms", 3200));
  const headless = getArg("headless", loginOnly ? "false" : "true") !== "false";

  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const chromeArgs = [
    headless ? "--headless=new" : "",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--disable-gpu-compositing",
    "--in-process-gpu",
    "--no-sandbox",
    "--disable-accelerated-2d-canvas",
    "--disable-accelerated-video-decode",
    "--disable-dev-shm-usage",
    "--disable-features=CalculateNativeWinOcclusion,VizDisplayCompositor",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ].filter(Boolean);

  let chrome = null;
  if (!connectPort) {
    chrome = spawn(chromePath, chromeArgs, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    chrome.stderr.on("data", (chunk) => {
      chromeStderr += chunk.toString();
    });
  }

  try {
    const { ws, send } = await connectPage(port);
    if (loginOnly) {
      await send("Page.navigate", { url: "https://snkrdunk.com/en/login" });
      console.log(`Chrome opened for login. Profile: ${profile}`);
      console.log("After login, close this process with Ctrl+C and run without --login.");
      await new Promise(() => {});
      return;
    }

    const targets = makeTargets();
    const existing = fs.existsSync(outFile)
      ? JSON.parse(fs.readFileSync(outFile, "utf8"))
      : [];
    const done = new Set(existing.map((item) => String(item.apparelId)));
    const output = [...existing];

    for (const target of targets) {
      if (done.has(String(target.apparelId))) continue;
      try {
        const item = await scrapeTarget(send, target, delayMs);
        output.push(item);
        done.add(String(target.apparelId));
        writeJsonFile(outFile, output);
        console.log(
          `${item.apparelId} ${item.history.length ? "history" : "no-history"} ${
            item.chart ? "chart" : "no-chart"
          } ${item.pageTitleLine}`
        );
      } catch (error) {
        output.push({
          ...target,
          scrapedAt: new Date().toISOString(),
          ok: false,
          error: String(error),
        });
        writeJsonFile(outFile, output);
        console.log(`${target.apparelId} failed ${String(error).slice(0, 120)}`);
      }
    }
    ws.close();
  } finally {
    if (chrome && !loginOnly) chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  if (typeof chromeStderr !== "undefined" && chromeStderr) {
    console.error(chromeStderr.slice(0, 1600));
  }
  process.exit(1);
});
