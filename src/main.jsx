import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RenewApp from './RenewApp';
import { configureNativeRuntime } from './lib/native-runtime';
import './index.css';

configureNativeRuntime();

const RootApp = new URLSearchParams(window.location.search).has('legacy') ? App : RenewApp;

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

  return <RootApp />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BootReadyApp />
  </React.StrictMode>
);
