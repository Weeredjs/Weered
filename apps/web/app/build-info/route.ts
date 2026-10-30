// Which build this server is running (the git commit baked in at `next build`,
// next.config.js). components/UpdateNotice.tsx compares it with the build a
// window was loaded from, so an installed app left open across a deploy can
// offer a reload. Not under /api: weered.ca sends only /api/office to the API,
// but the local proxy sends all of /api there.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
