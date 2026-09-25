export function cropPixels(rect, width, height) {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height, rect.viewportWidth, rect.viewportHeight, width, height].every(Number.isFinite)
    || rect.viewportWidth <= 0 || rect.viewportHeight <= 0 || width <= 0 || height <= 0
    || rect.x < 0 || rect.y < 0 || rect.width < 12 || rect.height < 12
    || rect.x + rect.width > rect.viewportWidth + 1 || rect.y + rect.height > rect.viewportHeight + 1) throw new Error('invalid_crop');
  const sx = width / rect.viewportWidth, sy = height / rect.viewportHeight;
  const x = Math.floor(rect.x * sx), y = Math.floor(rect.y * sy);
  return { x, y, width: Math.min(width - x, Math.ceil(rect.width * sx)), height: Math.min(height - y, Math.ceil(rect.height * sy)) };
}

// Serialized by chrome.scripting: keep this function self-contained.
export function selectCardRegion(token) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    host.id = token;
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{color-scheme:light}.veil{position:fixed;inset:0;cursor:crosshair;touch-action:none;user-select:none;background:#0002}.box{position:absolute;border:2px solid #ef4b35;box-shadow:0 0 0 9999px #0005;pointer-events:none;box-sizing:border-box}.cancel{position:absolute;right:16px;top:16px;border:0;border-radius:6px;padding:10px 15px;color:#fff;background:#17191b;font:600 14px sans-serif;cursor:pointer}';
    const veil = document.createElement('div'); veil.className = 'veil';
    const box = document.createElement('div'); box.className = 'box'; box.hidden = true;
    const cancel = document.createElement('button'); cancel.className = 'cancel'; cancel.textContent = '취소';
    veil.append(box, cancel); root.append(style, veil); document.documentElement.append(host);
    const viewportWidth = innerWidth, viewportHeight = innerHeight;
    let start, finished = false;
    const controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    const finish = rect => {
      if (finished) return;
      finished = true; clearTimeout(timer); controller.abort(); host.remove();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(rect)));
    };
    const point = event => ({ x: Math.max(0, Math.min(viewportWidth, event.clientX)), y: Math.max(0, Math.min(viewportHeight, event.clientY)) });
    const selection = event => {
      const end = point(event);
      return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(start.x - end.x), height: Math.abs(start.y - end.y), viewportWidth, viewportHeight };
    };
    const timer = setTimeout(() => finish(null), 20000);
    cancel.onclick = event => { event.stopPropagation(); finish(null); };
    veil.addEventListener('pointerdown', event => {
      if (event.target === cancel || event.button !== 0) return;
      event.preventDefault(); start = point(event); veil.setPointerCapture(event.pointerId); box.hidden = false;
      Object.assign(box.style, { left: `${start.x}px`, top: `${start.y}px`, width: '0', height: '0' });
    });
    veil.addEventListener('pointermove', event => {
      if (!start) return;
      const rect = selection(event);
      Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    });
    veil.addEventListener('pointerup', event => {
      if (!start) return;
      const rect = selection(event);
      finish(rect.width >= 12 && rect.height >= 12 ? rect : null);
    });
    veil.addEventListener('pointercancel', () => finish(null));
    window.addEventListener('keydown', event => { event.preventDefault(); event.stopPropagation(); if (event.key === 'Escape') finish(null); }, options);
    window.addEventListener('wheel', event => event.preventDefault(), { ...options, passive: false });
    for (const type of ['resize', 'scroll', 'pagehide']) window.addEventListener(type, () => finish(null), options);
  });
}

export function captureFailure(error) {
  const message = String(error?.message || '');
  if (message === 'tab_permission_required' || /permission|Cannot access contents|host permission/i.test(message)) {
    return { code: 'TAB_ACCESS', error: '현재 페이지에서 크롬 툴바의 Card Pone 아이콘을 누른 뒤 다시 스캔해 주세요.' };
  }
  if (message === 'unsupported_page' || /Cannot access a chrome|extensions gallery cannot be scripted/i.test(message)) {
    return { code: 'RESTRICTED_PAGE', error: '크롬 내부 화면에서는 스캔할 수 없습니다. 카드가 있는 웹페이지를 열어 주세요.' };
  }
  if (message === 'tab_changed' || /No tab with id|Frame.*removed/i.test(message)) {
    return { code: 'PAGE_CHANGED', error: '스캔 중 페이지가 변경되었습니다. 다시 스캔해 주세요.' };
  }
  if (message === 'window_unavailable') return { code: 'WINDOW', error: '현재 창을 찾지 못했습니다. 확장 프로그램을 다시 열어 주세요.' };
  if (/MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND|quota/i.test(message)) return { code: 'CAPTURE_LIMIT', error: '잠시 후 다시 스캔해 주세요.' };
  if (message === 'invalid_crop') return { code: 'CROP', error: '카드 영역을 조금 더 크게 선택해 주세요.' };
  const code = error?.stage === 'capture' ? 'CAPTURE' : 'SELECTION';
  return { code, error: `스캔하지 못했습니다. 다시 시도해 주세요. (${code})` };
}

export async function captureCard(chromeApi, tab, token) {
  if (!Number.isInteger(tab?.id) || tab.id < 0 || !Number.isInteger(tab.windowId)) throw new Error('window_unavailable');
  if (!tab.url) throw new Error('tab_permission_required');
  if (!/^https?:\/\//.test(tab.url) || /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)(\/|$)/i.test(tab.url)) throw new Error('unsupported_page');
  let stage = 'selection';
  try {
  const [selection] = await chromeApi.scripting.executeScript({ target: { tabId: tab.id }, func: selectCardRegion, args: [token] });
  const rect = selection?.result;
  if (!rect) return null;
  cropPixels(rect, rect.viewportWidth, rect.viewportHeight);
  const sameTab = async () => {
    const [active] = await chromeApi.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id || active.url !== tab.url) throw new Error('tab_changed');
  };
  await sameTab();
  const [viewport] = await chromeApi.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ width: innerWidth, height: innerHeight }) });
  if (viewport?.result?.width !== rect.viewportWidth || viewport?.result?.height !== rect.viewportHeight) throw new Error('tab_changed');
  stage = 'capture';
  const dataUrl = await chromeApi.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  await sameTab();
  return { dataUrl, rect };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    failure.stage = stage;
    throw failure;
  }
}
