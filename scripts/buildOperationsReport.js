import fs from 'node:fs/promises';

const STATUS_PRIORITY = {
  normal: 0,
  unknown: 1,
  warning: 2,
  critical: 3
};

const WORKFLOW_LABELS = {
  'Market price collector': '현재가',
  'Daily market trading history': '거래 이력',
  'PSA10 index history refresh': 'PSA10 이력',
  'Market index refresh': '인덱스',
  'SNKRDUNK box products sync': '상품 목록',
  'Deploy production': '운영 배포'
};

const WORKFLOW_FRESHNESS_HOURS = {
  'Market price collector': { warning: 8, critical: 12 },
  'Daily market trading history': { warning: 30, critical: 48 },
  'PSA10 index history refresh': { warning: 8, critical: 12 },
  'Market index refresh': { warning: 30, critical: 48 },
  'SNKRDUNK box products sync': { warning: 30, critical: 48 }
};

const FAILURE_CONCLUSIONS = new Set([
  'failure',
  'timed_out',
  'action_required',
  'startup_failure'
]);

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function percent(value, limit) {
  return limit > 0 ? value / limit * 100 : 0;
}

function usageStatus(value) {
  if (value >= 95) return 'critical';
  if (value >= 70) return 'warning';
  return 'normal';
}

function worstStatus(...statuses) {
  return statuses.reduce((worst, status) => (
    STATUS_PRIORITY[status] > STATUS_PRIORITY[worst] ? status : worst
  ), 'normal');
}

function statusLabel(status) {
  return {
    normal: '정상',
    warning: '주의',
    critical: '위험',
    unknown: '확인 필요'
  }[status] || '확인 필요';
}

function workflowStatus(run, name) {
  if (!run) return 'unknown';
  if (run.status !== 'completed') return 'warning';
  if (FAILURE_CONCLUSIONS.has(run.conclusion)) return 'critical';
  if (run.conclusion !== 'success') return 'warning';

  const freshness = WORKFLOW_FRESHNESS_HOURS[name];
  const updatedAt = new Date(run.updated_at).getTime();
  if (!freshness || !Number.isFinite(updatedAt)) return 'normal';
  const ageHours = (Date.now() - updatedAt) / (60 * 60 * 1000);
  if (ageHours >= freshness.critical) return 'critical';
  if (ageHours >= freshness.warning) return 'warning';
  return 'normal';
}

function formatKst(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

async function readD1Info() {
  const filePath = process.env.D1_INFO_PATH;
  if (!filePath) return null;
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
    return Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function fetchGitHubRuns() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) return { status: 'unknown', runs: [], summary: null };

  try {
    const payload = await fetchJson(
      `https://api.github.com/repos/${repository}/actions/runs?per_page=100`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'card-pone-operations-monitor',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentRuns = (payload.workflow_runs || []).filter((run) => (
      new Date(run.created_at).getTime() >= cutoff
    ));
    const latestByName = new Map();
    for (const run of payload.workflow_runs || []) {
      if (!latestByName.has(run.name)) latestByName.set(run.name, run);
    }
    const workflows = Object.entries(WORKFLOW_LABELS).map(([name, label]) => {
      const run = latestByName.get(name);
      return {
        name,
        label,
        status: workflowStatus(run, name),
        conclusion: run?.conclusion || run?.status || 'unknown',
        updatedAt: run?.updated_at || null,
        url: run?.html_url || null
      };
    });
    const failed = recentRuns.filter((run) => (
      run.status === 'completed' && FAILURE_CONCLUSIONS.has(run.conclusion)
    )).length;
    const running = recentRuns.filter((run) => run.status !== 'completed').length;
    return {
      status: workflows.length
        ? worstStatus(...workflows.map((workflow) => workflow.status))
        : running > 0 ? 'warning' : 'unknown',
      runs: workflows,
      summary: {
        total: recentRuns.length,
        success: recentRuns.filter((run) => run.conclusion === 'success').length,
        failed,
        running
      }
    };
  } catch {
    return { status: 'unknown', runs: [], summary: null };
  }
}

async function checkHttpStatus(url, headers = {}) {
  try {
    const startedAt = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'card-pone-operations-monitor',
        ...headers
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });
    return {
      status: response.ok ? 'normal' : 'critical',
      httpStatus: response.status,
      latencyMs: Date.now() - startedAt
    };
  } catch {
    return { status: 'critical', httpStatus: 0, latencyMs: null };
  }
}

async function fetchSupabaseUsage() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectUrl = process.env.SUPABASE_URL;
  const projectRef = process.env.SUPABASE_PROJECT_REF
    || String(projectUrl || '').match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!token || !projectRef) return null;

  try {
    const payload = await fetchJson(
      `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/usage.api-counts`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );
    const rows = Array.isArray(payload?.result) ? payload.result : [];
    const timestamps = rows
      .map((row) => Date.parse(row?.timestamp))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const totals = rows.reduce((result, row) => ({
      authRequests: result.authRequests + asNumber(row?.total_auth_requests),
      realtimeRequests: result.realtimeRequests + asNumber(row?.total_realtime_requests),
      restRequests: result.restRequests + asNumber(row?.total_rest_requests),
      storageRequests: result.storageRequests + asNumber(row?.total_storage_requests)
    }), {
      authRequests: 0,
      realtimeRequests: 0,
      restRequests: 0,
      storageRequests: 0
    });
    return {
      ...totals,
      from: timestamps.length ? new Date(timestamps[0]).toISOString() : null,
      to: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null
    };
  } catch {
    return null;
  }
}

async function fetchWorkersUsage() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) return null;

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const query = `
    query CardPoneWorkersUsage($accountTag: string!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptiveGroups(
            limit: 10000
            filter: { datetime_geq: $start, datetime_lt: $end }
          ) {
            sum { requests errors }
          }
        }
      }
    }
  `;
  try {
    const payload = await fetchJson('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: accountId,
          start: start.toISOString(),
          end: end.toISOString()
        }
      })
    });
    if (payload.errors?.length) return null;
    const groups = payload.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptiveGroups || [];
    return groups.reduce((result, group) => ({
      requests: result.requests + asNumber(group.sum?.requests),
      errors: result.errors + asNumber(group.sum?.errors)
    }), { requests: 0, errors: 0 });
  } catch {
    return null;
  }
}

function buildTelegramMessage(report) {
  const d1 = report.services.cloudflare.d1;
  const github = report.services.github;
  const freshness = report.dataFreshness;
  const lines = [
    '<b>CARD Pone 운영 리포트</b>',
    `<code>${formatKst(report.generatedAt)} KST</code>`,
    `<b>전체 상태: ${statusLabel(report.overallStatus)}</b>`,
    '',
    '<b>[Cloudflare 최근 24시간]</b>',
    `D1 읽기  <code>${d1.readPercent.toFixed(1)}%</code> · ${d1.rowsRead.toLocaleString('en-US')}행`,
    `D1 쓰기  <code>${d1.writePercent.toFixed(1)}%</code> · ${d1.rowsWritten.toLocaleString('en-US')}행`,
    `D1 저장  <code>${d1.storagePercent.toFixed(1)}%</code>`,
    report.services.cloudflare.workers
      ? `Functions <code>${report.services.cloudflare.workers.requests.toLocaleString('en-US')}</code>회 · 오류 ${report.services.cloudflare.workers.errors.toLocaleString('en-US')}`
      : 'Functions <code>집계 권한 확인 필요</code>',
    '',
    '<b>[데이터 최신성]</b>',
    ...freshness.map((item) => `${item.label}  ${statusLabel(item.status)} · ${formatKst(item.updatedAt)}`),
    '',
    '<b>[외부 서비스]</b>',
    `SNKRDUNK 수집  ${statusLabel(report.services.snkrdunk.status)}`,
    `Supabase Auth  ${statusLabel(report.services.supabase.status)}`,
    `홈페이지  ${statusLabel(report.services.website.status)} · ${report.services.website.latencyMs ?? '-'}ms`,
    '',
    '<b>[자동화 최근 24시간]</b>',
    github.summary
      ? `성공 ${github.summary.success} · 실패 ${github.summary.failed} · 진행 ${github.summary.running}`
      : 'GitHub Actions 집계 실패'
  ];
  return lines.join('\n');
}

function collectCriticalKeys(report) {
  const keys = [];
  for (const [service, value] of Object.entries(report.services || {})) {
    if (value?.status === 'critical') keys.push(`service:${service}`);
  }
  for (const workflow of report.services?.github?.runs || []) {
    if (workflow.status === 'critical') keys.push(`workflow:${workflow.name}`);
  }
  return keys.sort();
}

function criticalKeyLabel(key) {
  const [type, value] = String(key).split(':', 2);
  if (type === 'workflow') return WORKFLOW_LABELS[value] || value;
  return {
    cloudflare: 'Cloudflare',
    github: 'GitHub Actions',
    supabase: 'Supabase',
    snkrdunk: 'SNKRDUNK',
    website: '홈페이지'
  }[value] || value;
}

async function writeImmediateAlert(report) {
  const outputPath = process.env.IMMEDIATE_MESSAGE_OUTPUT;
  if (!outputPath) return;
  let previous = null;
  try {
    previous = JSON.parse(await fs.readFile(process.env.PREVIOUS_OPS_STATUS_PATH, 'utf8'));
  } catch {
    previous = null;
  }
  const previousKeys = new Set(previous ? collectCriticalKeys(previous) : []);
  const newCriticalKeys = collectCriticalKeys(report).filter((key) => !previousKeys.has(key));
  const message = newCriticalKeys.length
    ? [
      '<b>CARD Pone 긴급 운영 알림</b>',
      `<code>${report.reportDate}</code>`,
      '',
      ...newCriticalKeys.map((key) => `${criticalKeyLabel(key)} · 위험 상태 전환`),
      '',
      '관리자 대시보드에서 상세 상태를 확인하세요.'
    ].join('\n')
    : '';
  await fs.writeFile(outputPath, message);
}

const d1Info = await readD1Info();
const hasD1Info = Boolean(d1Info);
const rowsRead = asNumber(d1Info?.rows_read_24h);
const rowsWritten = asNumber(d1Info?.rows_written_24h);
const storageBytes = asNumber(d1Info?.database_size);
const d1 = {
  status: hasD1Info ? worstStatus(
    usageStatus(percent(rowsRead, 5_000_000)),
    usageStatus(percent(rowsWritten, 100_000)),
    usageStatus(percent(storageBytes, 5 * 1024 * 1024 * 1024))
  ) : 'unknown',
  rowsRead,
  rowsWritten,
  storageBytes,
  readPercent: percent(rowsRead, 5_000_000),
  writePercent: percent(rowsWritten, 100_000),
  storagePercent: percent(storageBytes, 5 * 1024 * 1024 * 1024)
};

const [github, website, supabase, supabaseUsage, workers] = await Promise.all([
  fetchGitHubRuns(),
  checkHttpStatus('https://www.optcgkorea.com/'),
  checkHttpStatus(
    `${process.env.SUPABASE_URL || 'https://omxrcqjmnsthxyvnunjj.supabase.co'}/auth/v1/health`,
    process.env.SUPABASE_PUBLISHABLE_KEY
      ? { apikey: process.env.SUPABASE_PUBLISHABLE_KEY }
      : {}
  ),
  fetchSupabaseUsage(),
  fetchWorkersUsage()
]);

const freshness = github.runs
  .filter((item) => ['Market price collector', 'Daily market trading history', 'PSA10 index history refresh', 'Market index refresh'].includes(item.name))
  .map((item) => ({
    key: item.name,
    label: item.label,
    status: item.status,
    updatedAt: item.updatedAt,
    url: item.url
  }));
const snkrWorkflows = github.runs.filter((item) => (
  ['Market price collector', 'Daily market trading history', 'PSA10 index history refresh'].includes(item.name)
));
const snkrdunkStatus = snkrWorkflows.length
  ? worstStatus(...snkrWorkflows.map((item) => item.status))
  : 'unknown';
const cloudflareStatus = worstStatus(d1.status, website.status);
const overallStatus = worstStatus(
  cloudflareStatus,
  github.status,
  supabase.status,
  snkrdunkStatus,
  ...freshness.map((item) => item.status)
);
const reportDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  reportDate,
  overallStatus,
  services: {
    cloudflare: {
      status: cloudflareStatus,
      d1,
      workers,
      r2: {
        status: 'unknown',
        note: 'R2 상세 사용량은 Cloudflare 대시보드에서 확인'
      }
    },
    github,
    supabase: {
      ...supabase,
      usage: supabaseUsage,
      note: supabaseUsage
        ? 'Management API 기본 조회 구간 요청량'
        : '정확한 요청량은 로컬 Supabase Management API 토큰을 로드한 수동 점검에서 표시'
    },
    snkrdunk: {
      status: snkrdunkStatus,
      workflows: snkrWorkflows
    },
    website
  },
  dataFreshness: freshness
};

const outputPath = process.env.OPS_STATUS_OUTPUT || 'operations-status.json';
const messagePath = process.env.TELEGRAM_MESSAGE_OUTPUT || 'operations-telegram-message.txt';
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(messagePath, buildTelegramMessage(report));
await writeImmediateAlert(report);
console.log(JSON.stringify({
  outputPath,
  messagePath,
  overallStatus,
  d1: {
    readPercent: d1.readPercent.toFixed(1),
    writePercent: d1.writePercent.toFixed(1),
    storagePercent: d1.storagePercent.toFixed(1)
  },
  github: github.summary
}, null, 2));
