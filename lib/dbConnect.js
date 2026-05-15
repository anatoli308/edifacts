/**
 * Legacy compatibility stub.
 * =========================
 * Mongoose has been replaced by Prisma. The Prisma client is lazy-connected
 * on first query, so an explicit "connect" call is unnecessary. This stub
 * keeps existing `await dbConnect()` call sites working without breakage.
 *
 * New code should import { prisma } from '@/lib/db/prisma' directly.
 */
import prisma from './db/prisma.js';

async function dbConnect() {
    return prisma;
}

export default dbConnect;
