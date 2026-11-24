// Liveness check for the Docker HEALTHCHECK and uptime monitors.
// Deliberately touches nothing external, so it reports whether the Next.js
// server itself is up.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true });
}
