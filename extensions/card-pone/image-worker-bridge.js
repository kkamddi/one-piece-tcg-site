export async function createImageWorker(signal) {
  signal.throwIfAborted();
  const response = await fetch('./image-engine.js', { signal });
  if (!response.ok) throw new Error('이미지 엔진을 불러오지 못했습니다.');
  const code = await response.text();
  signal.throwIfAborted();
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.title = 'Card image engine';
  const channel = new MessageChannel();
  let stopped = false;
  const bridge = {
    onmessage: null,
    onerror: null,
    postMessage: (data, transfer) => { if (!stopped) channel.port1.postMessage(data, transfer); },
    terminate() {
      if (stopped) return;
      stopped = true;
      signal.removeEventListener('abort', bridge.terminate);
      channel.port1.close(); channel.port2.close(); frame.remove();
    }
  };
  try {
    await new Promise((resolve, reject) => {
      const finish = error => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        error ? reject(error) : resolve();
      };
      const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('이미지 엔진 시작 시간이 초과되었습니다.')), 15000);
      signal.addEventListener('abort', abort, { once: true });
      channel.port1.onmessage = ({ data }) => {
        if (data.ready) finish();
        else if (data.fatal) finish(new Error('이미지 엔진을 시작하지 못했습니다.'));
      };
      frame.onload = () => frame.contentWindow.postMessage({ type: 'card-pone-engine', code }, '*', [channel.port2]);
      frame.onerror = () => finish(new Error('이미지 엔진을 불러오지 못했습니다.'));
      frame.src = './sandbox.html';
      document.body.append(frame);
    });
    signal.throwIfAborted();
    channel.port1.onmessage = event => event.data.fatal ? bridge.onerror?.(event) : bridge.onmessage?.(event);
    signal.addEventListener('abort', bridge.terminate, { once: true });
    return bridge;
  } catch (error) { bridge.terminate(); throw error; }
}
