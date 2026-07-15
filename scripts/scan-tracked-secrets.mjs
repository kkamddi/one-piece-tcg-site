import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/g],
  ['GitHub token', /(?:github_pat_[0-9A-Za-z_]{20,}|gh[pousr]_[0-9A-Za-z]{20,})/g],
  ['OpenAI API key', /sk-[0-9A-Za-z_-]{20,}/g],
  ['AWS access key', /AKIA[0-9A-Z]{16}/g],
  ['Slack token', /xox[baprs]-[0-9A-Za-z-]{10,}/g],
  ['Telegram bot token', /\b\d{8,10}:[0-9A-Za-z_-]{30,}\b/g],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{80,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];
const assignmentPattern = /(?:^|[,{;\s])["']?([a-z0-9_]*(?:api[_-]?key|api[_-]?token|access[_-]?token|client[_-]?secret|private[_-]?key|password|webhook[_-]?url))["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']/gim;
const safeLiteral = /^(?:placeholder|example|your[_-]|process\.env|import\.meta\.env|\$\{\{|<)/i;

function scanSource(file, source, ref = '') {
  if (source.includes('\0')) return [];
  const findings = [];

  for (const [kind, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      const fingerprint = createHash('sha256').update(match[0]).digest('hex').slice(0, 12);
      findings.push({ file, line, kind, fingerprint, ref });
    }
  }

  assignmentPattern.lastIndex = 0;
  for (const match of source.matchAll(assignmentPattern)) {
    if (safeLiteral.test(match[2])) continue;
    const line = source.slice(0, match.index).split('\n').length;
    const fingerprint = createHash('sha256').update(match[2]).digest('hex').slice(0, 12);
    findings.push({ file, line, kind: `hardcoded ${match[1]}`, fingerprint, ref });
  }

  return findings;
}

function printFindings(findings, heading) {
  console.error(heading);
  for (const finding of findings) {
    const ref = finding.ref ? `${finding.ref.slice(0, 12)} ` : '';
    console.error(`- ${ref}${finding.file}:${finding.line} ${finding.kind} (${finding.fingerprint})`);
  }
}

if (process.argv.includes('--history')) {
  const commits = execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  const unique = new Map();

  for (const commit of commits) {
    const files = execFileSync(
      'git',
      ['diff-tree', '--root', '-m', '--no-commit-id', '--name-only', '-z', '-r', '--diff-filter=AMCR', commit],
      { encoding: 'utf8' },
    ).split('\0').filter(Boolean);

    for (const file of new Set(files)) {
      let source;
      try {
        source = execFileSync('git', ['show', `${commit}:${file}`], {
          encoding: 'utf8',
          maxBuffer: 20 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      } catch {
        continue;
      }
      for (const finding of scanSource(file, source, commit)) {
        const key = `${finding.file}\0${finding.kind}\0${finding.fingerprint}`;
        if (!unique.has(key)) unique.set(key, finding);
      }
    }
  }

  const findings = [...unique.values()];
  if (findings.length) {
    printFindings(findings, 'Potential secrets found in Git history (values redacted):');
    process.exit(1);
  }
  console.log(`No high-confidence secrets found across ${commits.length} commits.`);
  process.exit(0);
}

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const findings = [];

for (const file of tracked) {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  findings.push(...scanSource(file, source));
}

if (findings.length) {
  printFindings(findings, 'Potential tracked secrets detected (values redacted):');
  process.exit(1);
}

console.log(`No high-confidence secrets found in ${tracked.length} tracked files.`);
