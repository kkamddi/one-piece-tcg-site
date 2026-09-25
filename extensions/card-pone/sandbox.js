// OpenCV's generated bindings need dynamic compilation. This frame has no
// extension APIs, network access, or page access; only a private message port.
let initialized = false;
window.addEventListener('message', event => {
  if (initialized || event.source !== parent || event.data?.type !== 'card-pone-engine' || !event.ports[0] || typeof event.data.code !== 'string') return;
  initialized = true;
  const port = event.ports[0];
  try {
    const url = URL.createObjectURL(new Blob([event.data.code], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = ({ data }) => port.postMessage(data, data.result?.pixels ? [data.result.pixels] : []);
    worker.onerror = () => port.postMessage({ fatal: true });
    port.onmessage = ({ data }) => worker.postMessage(data, data.pixels ? [data.pixels] : []);
    port.postMessage({ ready: true });
    window.addEventListener('pagehide', () => { worker.terminate(); URL.revokeObjectURL(url); port.close(); }, { once: true });
  } catch { port.postMessage({ fatal: true }); }
});
