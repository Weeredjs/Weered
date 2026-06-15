// Global setup for integration tests. SAFETY GATE: refuses to run unless
// DATABASE_URL points at a *test* database, so an integration run can never
// touch (or truncate) production data. CI + local both set DATABASE_URL to the
// weered_test DB and run `prisma db push` against it before invoking vitest.
export default function () {
  const raw = process.env.DATABASE_URL || "";
  let dbName = "";
  try {
    dbName = new URL(raw).pathname.replace(/^\//, "");
  } catch {
    throw new Error(
      "[integration] DATABASE_URL is unset or unparseable — set it to the weered_test database.",
    );
  }
  if (!/test/i.test(dbName)) {
    throw new Error(
      `[integration] REFUSING TO RUN: DATABASE_URL database is "${dbName}", which is not a test DB. ` +
        `Integration tests mutate data — point DATABASE_URL at weered_test (e.g. .../weered_test) first.`,
    );
  }

  console.log(`[integration] DB safety gate OK — using test database "${dbName}".`);
}
