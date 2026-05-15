/**
 * Prisma Client Singleton
 * =======================
 * Replaces Mongoose connection cache from lib/dbConnect.js.
 *
 * In Next.js dev mode, hot reloads would otherwise create a new client per
 * reload, exhausting the connection pool. We attach the instance to the global
 * scope in development so it's reused across reloads.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global;

const createPrismaClient = () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development'
            ? ['warn', 'error']
            : ['error'],
    });
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export default prisma;
