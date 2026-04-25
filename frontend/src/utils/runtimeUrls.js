const DEFAULT_BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '5000';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const normalizeHost = (hostname = '') => hostname.replace(/^\[|\]$/g, '').toLowerCase();

const isLoopbackHost = (hostname = '') => LOOPBACK_HOSTS.has(normalizeHost(hostname));

const buildBackendOrigin = (port = DEFAULT_BACKEND_PORT) => {
  if (typeof window === 'undefined') {
    return `http://localhost:${port}`;
  }

  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

const resolveConfiguredUrl = (configuredUrl, fallbackPath = '') => {
  if (!configuredUrl) {
    return `${buildBackendOrigin()}${fallbackPath}`;
  }

  if (typeof window === 'undefined') {
    return trimTrailingSlash(configuredUrl);
  }

  if (configuredUrl.startsWith('/')) {
    return trimTrailingSlash(configuredUrl);
  }

  try {
    const url = new URL(configuredUrl, window.location.origin);

    if (isLoopbackHost(url.hostname) && !isLoopbackHost(window.location.hostname)) {
      return `${buildBackendOrigin(url.port || DEFAULT_BACKEND_PORT)}${fallbackPath || url.pathname}`;
    }

    const path = url.pathname && url.pathname !== '/' ? url.pathname : '';
    return trimTrailingSlash(`${url.origin}${path}`);
  } catch {
    return trimTrailingSlash(configuredUrl);
  }
};

export const resolveApiUrl = () => resolveConfiguredUrl(import.meta.env.VITE_API_URL, '/api/v1');

export const resolveSocketUrl = () => resolveConfiguredUrl(import.meta.env.VITE_SOCKET_URL);

