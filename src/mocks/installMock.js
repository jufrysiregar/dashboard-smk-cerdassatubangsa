// Wires the localStorage router into the app:
//  - a custom axios adapter for every call made through `api`
//  - a window.fetch shim for the handful of raw fetch('/api/...') calls
//  - ensures the demo dataset is seeded before the first request
//
// Nothing here talks to a real backend; the app runs 100% client-side.

import { ensureSeeded } from './demoSeeder';
import { handle } from './handlers';

function fdToObject(fd) {
  const out = {};
  try {
    fd.forEach((value, key) => {
      if (value instanceof File || value instanceof Blob) {
        out[key] = value;
      } else if (key.endsWith('[]')) {
        const k = key.slice(0, -2);
        (out[k] = out[k] || []).push(value);
      } else {
        out[key] = value;
      }
    });
  } catch {
    /* not a FormData */
  }
  return out;
}

function parseBody(data) {
  if (data == null) return {};
  if (typeof FormData !== 'undefined' && data instanceof FormData) return fdToObject(data);
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  if (typeof data === 'object') return data;
  return {};
}

function normalizePath(url, baseURL) {
  let p = String(url || '');
  const base = String(baseURL || '').replace(/\/$/, '');
  if (base && p.startsWith(base)) p = p.slice(base.length);
  // strip query string
  const qi = p.indexOf('?');
  if (qi >= 0) p = p.slice(0, qi);
  if (!p.startsWith('/')) p = '/' + p;
  // axios baseURL already ends with /api; strip a leading /api if present
  if (p === '/api' || p.startsWith('/api/')) p = p.slice(4);
  if (!p) p = '/';
  return p;
}

function buildQuery(config, url) {
  const q = { ...(config.params || {}) };
  const qi = String(url || '').indexOf('?');
  if (qi >= 0) {
    new URLSearchParams(String(url).slice(qi + 1)).forEach((v, k) => { q[k] = v; });
  }
  return q;
}

function tokenFrom(config) {
  const h = config.headers || {};
  return h.Authorization || h.authorization || h.get?.('Authorization') || '';
}

function makeError(config, status, body) {
  const err = new Error(body?.message || `Request failed with status ${status}`);
  err.config = config;
  err.isAxiosError = true;
  err.response = { status, data: body, headers: {}, config };
  return err;
}

function toResponse(config, status, body) {
  if (config.responseType === 'blob') {
    const blob = new Blob([JSON.stringify(body ?? {})], { type: 'application/json' });
    return { data: blob, status: 200, statusText: 'OK', headers: {}, config };
  }
  return { data: body, status, statusText: 'OK', headers: {}, config };
}

export function mockAdapter(config) {
  ensureSeeded();
  const method = String(config.method || 'get').toLowerCase();
  const path = normalizePath(config.url, config.baseURL);
  const ctx = {
    body: parseBody(config.data),
    query: buildQuery(config, config.url),
    token: tokenFrom(config),
  };
  let result;
  try {
    result = handle(method, path, ctx);
  } catch (e) {
    // Never let a mock bug white-screen the app: treat as empty success.
    // eslint-disable-next-line no-console
    console.warn('[demo-mock] handler error for', method, path, e);
    result = method === 'get' ? { data: [] } : { message: 'ok', success: true, data: {} };
  }
  if (result && result.__error) {
    return Promise.reject(makeError(config, result.__error.status, result.__error.body));
  }
  return Promise.resolve(toResponse(config, 200, result));
}

// ---- raw fetch shim ---------------------------------------------------------
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : null;

function installFetchShim() {
  if (typeof window === 'undefined' || !nativeFetch) return;
  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    if (!/\/api\//.test(rawUrl) && !rawUrl.startsWith('/api')) return nativeFetch(input, init);

    ensureSeeded();
    const method = String(init.method || (typeof input === 'object' && input?.method) || 'GET').toLowerCase();
    let path = rawUrl.replace(/^https?:\/\/[^/]+/, '');
    const qi = path.indexOf('?');
    const query = {};
    if (qi >= 0) {
      new URLSearchParams(path.slice(qi + 1)).forEach((v, k) => { query[k] = v; });
      path = path.slice(0, qi);
    }
    if (path.startsWith('/api/')) path = path.slice(4);
    if (!path.startsWith('/')) path = '/' + path;

    let body = {};
    if (init.body) {
      if (typeof init.body === 'string') { try { body = JSON.parse(init.body); } catch { body = {}; } }
      else if (typeof FormData !== 'undefined' && init.body instanceof FormData) body = fdToObject(init.body);
      else if (typeof init.body === 'object') body = init.body;
    }
    const auth = (init.headers && (init.headers.Authorization || init.headers.authorization))
      || (typeof input === 'object' && input?.headers?.get?.('Authorization')) || '';

    let result;
    try {
      result = handle(method, path, { body, query, token: auth });
    } catch (e) {
      result = method === 'get' ? { data: [] } : { message: 'ok', success: true };
    }
    const status = result && result.__error ? result.__error.status : 200;
    const payload = result && result.__error ? result.__error.body : result;
    return new Response(JSON.stringify(payload ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

let installed = false;
export function installMock(api) {
  if (installed) return;
  installed = true;
  ensureSeeded();
  installFetchShim();
  api.defaults.adapter = mockAdapter;
}
