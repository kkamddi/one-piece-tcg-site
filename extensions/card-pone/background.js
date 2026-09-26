import { captureCard, captureFailure } from './capture.js';
import { openMemberLogin, verifyMember, MEMBER_REQUIRED } from './member.js';

// Use the actual toolbar action so opening an already visible panel also
// invokes activeTab for the page the user is currently looking at.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});
let capturing = false;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('panel.html')
    && ['card-pone-member-login', 'card-pone-member-check'].includes(message?.type)) {
    (async () => {
      try {
        if (message.type === 'card-pone-member-login') {
          await openMemberLogin(chrome); respond({ opened: true });
        } else respond(await verifyMember(chrome));
      } catch { respond({ member: false, error: MEMBER_REQUIRED }); }
    })();
    return true;
  }
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('panel.html') || message?.type !== 'card-pone-scan') return;
  if (capturing) { respond({ error: '이미 스캔 영역을 선택하고 있습니다.' }); return; }
  capturing = true;
  (async () => {
    try {
      if (!Number.isInteger(message.windowId) || message.windowId < 0) throw new Error('window_unavailable');
      const [tab] = await chrome.tabs.query({ active: true, windowId: message.windowId });
      // Preserve activeTab error handling; never capture before server verification.
      if (!tab?.url) throw new Error('tab_permission_required');
      try { await verifyMember(chrome); }
      catch { respond({ error: MEMBER_REQUIRED, code: 'MEMBER_REQUIRED' }); return; }
      const capture = await captureCard(chrome, tab, `card-pone-scan-${crypto.randomUUID()}`);
      respond({ capture });
    } catch (error) {
      respond(captureFailure(error));
    } finally { capturing = false; }
  })();
  return true;
});
