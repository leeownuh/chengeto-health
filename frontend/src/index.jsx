/**
 * CHENGETO Health - Frontend Entry Point
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';
import { resolveApiUrl } from './utils/runtimeUrls';

const legacyApiBaseUrl = resolveApiUrl().replace(/\/api\/v1\/?$/, '');

axios.defaults.baseURL = legacyApiBaseUrl;
axios.defaults.withCredentials = true;
axios.defaults.headers.common['Content-Type'] = 'application/json';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = config.headers.Authorization || `Bearer ${token}`;
  }

  return config;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
