import type { FastifyInstance } from "fastify";

/**
 * An empty body sent as application/json reads as {} instead of failing the
 * whole request with 400 "Body cannot be empty" (FST_ERR_CTP_EMPTY_JSON_BODY).
 * The web's request helpers labelled every request JSON, so every bodiless
 * action failed silently: kick, unban, delete a post, leave a lobby. Sentry
 * ignores that error, which is why nobody saw it (2026-11-01 ops audit). The
 * web is fixed too; this covers every other client (phone, desktop, old tabs).
 * Anything with a body still goes through Fastify's own JSON parser, with its
 * prototype-poisoning guards.
 */
// Any server/logger flavour: the API's app carries its own pino logger type.
export function allowEmptyJsonBody(app: FastifyInstance<any, any, any, any, any>) {
  const parse = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    const text = String(body);
    if (text.trim() === "") return done(null, {});
    parse(req, text, done);
  });
}
