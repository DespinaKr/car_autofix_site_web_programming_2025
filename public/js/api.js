// /js/api.js
window.api = async (url, opts = {}) => {
  const headers = opts.headers ? { ...opts.headers } : {};
  let body = opts.body;

  if (opts.rawBody !== undefined) {
    body = opts.rawBody; // π.χ. CSV upload
  } else if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body,
    credentials: 'include'   // << κρατάει το session-cookie σε ΟΛΕΣ τις σελίδες
  });

  if (res.status === 204) return null;
  if (res.status === 401) {
    if (!location.pathname.includes('/login')) location.href = '/login.html';
    throw new Error('Unauthorized');
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
};
