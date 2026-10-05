import React from 'react';
import ReactDOM from 'react-dom/client';
import RenewApp from './RenewApp';
import { configureNativeRuntime } from './lib/native-runtime';
import './index.css';

configureNativeRuntime();

// A tab opened before a deploy still asks for the previous build's chunks, which no longer exist.
// Reload once per page so it picks up the new build instead of failing (e.g. the catalog fallback data).
window.addEventListener('vite:preloadError', (event) => {
  const key = 'card-pone:chunk-reload';
  try {
    if (window.sessionStorage.getItem(key) === window.location.pathname) return;
    window.sessionStorage.setItem(key, window.location.pathname);
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

// The legacy app only serves ?legacy, so it stays out of the main bundle.
const App = React.lazy(() => import('./App'));
const RecognitionLab = import.meta.env.DEV ? React.lazy(() => import('./CardRecognitionLab.jsx')) : null;
const localRecognition = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) && window.location.pathname === '/dev/card-recognition';
const RootApp = localRecognition ? RecognitionLab : new URLSearchParams(window.location.search).has('legacy') ? App : RenewApp;

function BootReadyApp() {
  React.useLayoutEffect(() => {
    window.clearTimeout(window.__CARD_PONE_BOOT_TIMER__);
    document.documentElement.classList.remove('card-pone-js-booting');
    document.documentElement.classList.remove('card-pone-js-boot-failed');
    try {
      window.sessionStorage.removeItem('card-pone:boot-retry');
    } catch {
      // Storage can be unavailable in strict privacy modes.
    }
    const url = new URL(window.location.href);
    if (url.searchParams.has('_app_retry')) {
      url.searchParams.delete('_app_retry');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  return <React.Suspense fallback={<p role="status">불러오는 중...</p>}><RootApp /></React.Suspense>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BootReadyApp />
  </React.StrictMode>
);
