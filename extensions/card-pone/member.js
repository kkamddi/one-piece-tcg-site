export const MEMBER_ORIGIN = 'https://www.optcgkorea.com';
const TAB_KEY = 'cardPoneMemberTab';
export const MEMBER_REQUIRED = 'Card Pone 로그인 후 연결 확인을 눌러 주세요.';

// Only the extension-created login tab is accessed, never arbitrary existing tabs.
export async function openMemberLogin(api) {
  const tab = await api.tabs.create({ url: `${MEMBER_ORIGIN}/portfolio` });
  await api.storage.session.set({ [TAB_KEY]: tab.id });
}

// Executed in the isolated world, top frame only. Refresh tokens never leave the site.
export function readMemberAccessToken() {
  if (location.origin !== 'https://www.optcgkorea.com') return null;
  try {
    const session = JSON.parse(localStorage.getItem('sb-omxrcqjmnsthxyvnunjj-auth-token'));
    if (typeof session?.access_token !== 'string' || !Number.isFinite(session.expires_at)
      || session.expires_at * 1000 <= Date.now()) return null;
    return session.access_token;
  } catch { return null; }
}

export async function verifyMember(api, request = fetch) {
  const saved = await api.storage.session.get(TAB_KEY);
  const tabId = saved[TAB_KEY];
  if (!Number.isInteger(tabId)) throw new Error(MEMBER_REQUIRED);
  const tab = await api.tabs.get(tabId);
  if (!tab.url || new URL(tab.url).origin !== MEMBER_ORIGIN) throw new Error(MEMBER_REQUIRED);
  const results = await api.scripting.executeScript({
    target: { tabId, frameIds: [0] }, world: 'ISOLATED', func: readMemberAccessToken
  });
  const token = results.find(row => row.frameId === 0)?.result;
  if (typeof token !== 'string' || !token) throw new Error(MEMBER_REQUIRED);
  const response = await request(`${MEMBER_ORIGIN}/api/extension-member`, {
    headers: { Authorization: `Bearer ${token}` }, credentials: 'omit',
    cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(MEMBER_REQUIRED);
  const result = await response.json();
  if (result.member !== true || typeof result.memberId !== 'string' || !result.memberId) throw new Error(MEMBER_REQUIRED);
  const latest = await api.scripting.executeScript({
    target: { tabId, frameIds: [0] }, world: 'ISOLATED', func: readMemberAccessToken
  });
  if (latest.find(row => row.frameId === 0)?.result !== token) throw new Error(MEMBER_REQUIRED);
  return { member: true, memberId: result.memberId };
}

export async function requireMember() {
  // Loopback preview is a developer harness, not a distributable unauthenticated mode.
  if (!globalThis.chrome?.runtime?.id) {
    if (['localhost', '127.0.0.1'].includes(globalThis.location?.hostname)) return { memberId: 'local-preview' };
    throw new Error(MEMBER_REQUIRED);
  }
  const response = await chrome.runtime.sendMessage({ type: 'card-pone-member-check' });
  if (!response?.member) throw new Error(MEMBER_REQUIRED);
  return response;
}
