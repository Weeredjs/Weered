import { prisma } from "./prisma";

// Site config key/value helpers extracted from index.ts.

export async function getSiteConfig(key: string): Promise<string | null> {
  const row = await prisma.siteConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSiteConfig(key: string, value: string): Promise<void> {
  await prisma.siteConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getAllSiteConfig(): Promise<Record<string, string>> {
  const rows = await prisma.siteConfig.findMany();
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value;
  return config;
}

export const SITE_CONFIG_DEFAULTS: Record<string, string> = {
  featuredLobbyId: "",
  registrationOpen: "true",
  // Most real accounts there can be (0 = no cap); lib/registration.ts.
  registrationCap: "1000",
  maintenanceMode: "false",
  aiEnabled: "true",
  defaultTier: "INNOCENT",
};
