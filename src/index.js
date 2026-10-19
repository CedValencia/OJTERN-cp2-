import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import AdminScreen from './Screens/AdminScreen';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// The separate Administrator account has its own page at /admin. It is checked here,
// before <App /> mounts, so it never goes through the role sign-in or the app's routes.
const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isAdminRoute ? (
      <AdminScreen onExit={() => { window.location.href = '/'; }} />
    ) : (
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example, reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register the service worker so the app can be installed as a PWA and
// work offline. This only takes effect in a production build (npm run
// build) served over HTTPS or localhost.
serviceWorkerRegistration.unregister();