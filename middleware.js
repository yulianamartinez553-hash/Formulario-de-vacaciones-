import { next } from '@vercel/edge';

/**
 * Protege la ruta de generación de PDF / impresión RRHH.
 * Usuario/clave por defecto (cambialos en Vercel → Settings → Environment Variables):
 *   RRHH_USER=rrhh
 *   RRHH_PASSWORD=ServinorteRRHH2026
 */
export const config = {
  matcher: ['/rrhh', '/rrhh/(.*)', '/formulario', '/formulario.html']
};

export default function middleware(request) {
  const user = process.env.RRHH_USER || 'rrhh';
  const pass = process.env.RRHH_PASSWORD || 'ServinorteRRHH2026';

  const header = request.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const i = decoded.indexOf(':');
      const u = i >= 0 ? decoded.slice(0, i) : '';
      const p = i >= 0 ? decoded.slice(i + 1) : '';
      if (u === user && p === pass) {
        const url = new URL(request.url);
        // /formulario → misma app de PDF
        if (url.pathname === '/formulario' || url.pathname === '/formulario.html') {
          url.pathname = '/rrhh';
          return Response.redirect(url, 302);
        }
        return next();
      }
    } catch (_) {
      /* auth inválida */
    }
  }

  return new Response('Acceso restringido — RRHH Servinorte', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="RRHH Servinorte — solo personal autorizado"',
      'Cache-Control': 'no-store'
    }
  });
}
