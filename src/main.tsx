import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app.css';
import './design.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const wasControlled = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      // iOS may not check for a new worker promptly when the home-screen app opens.
      return registration.update();
    }).catch(() => undefined);

    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wasControlled || refreshed) return;
      refreshed = true;
      window.location.reload();
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
