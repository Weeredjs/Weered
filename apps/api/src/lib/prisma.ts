import { PrismaClient } from "@prisma/client";

// Single Prisma client used by index.ts and every route module.
// Exported as both a named and default for convenience — pick whichever
// import style you prefer in new code.
export const prisma = new PrismaClient();
export default prisma;
