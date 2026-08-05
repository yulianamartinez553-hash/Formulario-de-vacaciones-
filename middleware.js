import { next } from '@vercel/edge';

/**
 * /rrhh usa login en la propia página (más claro que el cartel del navegador).
 * Redirige alias viejos a /rrhh.
 */
export const config = {
  matcher: ['/formulario', '/formulario.html']
};

export default function middleware(request) {
  const url = new URL(request.url);
  url.pathname = '/rrhh';
  return Response.redirect(url, 302);
}
