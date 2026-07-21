import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import RenewApp from './RenewApp';
import { configureNativeRuntime } from './lib/native-runtime';
import './index.css';

configureNativeRuntime();

const RootApp = new URLSearchParams(window.location.search).has('legacy') ? App : RenewApp;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);

window.requestAnimationFrame(() => {
  document.documentElement.classList.remove('card-pone-js-booting');
});
