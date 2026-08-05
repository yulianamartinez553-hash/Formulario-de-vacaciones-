import { next } from '@vercel/edge';

/**
 * Protege /rrhh (generación PDF). El control público en / no pide clave.
 *
 * Vercel → Settings → Environment Variables:
 *   RRHH_USER
 *   RRHH_PASSWORD
 *
 * Defaults: rrhh / ServinorteRRHH2026
 */
export const config = {
  matcher: ['/rrhh', '/rrhh.html', '/formulario', '/formulario.html']
};

function authorized(request) {
  const user = process.env.RRHH_USER || 'rrhh';
  const pass = process.env.RRHH_PASSWORD || 'ServinorteRRHH2026';
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(':');
    const u = i >= 0 ? decoded.slice(0, i) : '';
    const p = i >= 0 ? decoded.slice(i + 1) : '';
    return u === user && p === pass;
  } catch (_) {
    return false;
  }
}

export default function middleware(request) {
  if (!authorized(request)) {
    return new Response('Acceso restringido — RRHH Servinorte', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="RRHH Servinorte — solo personal autorizado"',
        'Cache-Control': 'no-store'
      }
    });
  }

  const url = new URL(request.url);
  // Alias viejos → ruta privada canónica
  if (url.pathname === '/formulario' || url.pathname === '/formulario.html') {
    url.pathname = '/rrhh';
    return Response.redirect(url, 302);
  }

  return next();
}
