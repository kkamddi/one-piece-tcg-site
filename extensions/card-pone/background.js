import { captureCard, captureFailure } from './capture.js';

// Use the actual toolbar action so opening an already visible panel also
// invokes activeTab for the page the user is currently looking at.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});
let capturing = false;
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('panel.html') || message?.type !== 'card-pone-scan') return;
  if (capturing) { respond({ error: '이미 스캔 영역을 선택하고 있습니다.' }); return; }
  capturing = true;
  (async () => {
    try {
      if (!Number.isInteger(message.windowId) || message.windowId < 0) throw new Error('window_unavailable');
      const [tab] = await chrome.tabs.query({ active: true, windowId: message.windowId });
      const capture = await captureCard(chrome, tab, `card-pone-scan-${crypto.randomUUID()}`);
      respond({ capture });
    } catch (error) {
      respond(captureFailure(error));
    } finally { capturing = false; }
  })();
  return true;
});
