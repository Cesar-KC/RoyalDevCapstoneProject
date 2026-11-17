import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router";
import './index.css'
import App from './App.jsx'

// ngrok's free plan shows a browser warning page instead of forwarding some requests.
// This header tells ngrok to skip it. It's only added to our own /api calls
// (same origin), never to other sites. Remove this block if the backend moves off ngrok.
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const rawUrl = input instanceof Request ? input.url : String(input);
  const url = new URL(rawUrl, window.location.origin);
  
  if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) {
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("ngrok-skip-browser-warning", "true");
    return originalFetch(input, { ...init, headers });
  }

  return originalFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
