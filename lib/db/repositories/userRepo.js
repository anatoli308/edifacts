/**
 * User Repository
 * ===============
 * All user/auth/token persistence concerns. Encapsulates:
 * - Password hashing (was a Mongoose pre-save hook)
 * - JWT issuance + per-device token storage (was User.generateAuthToken)
 * - Credential-based login (was User.findByCredentials)
 *
 * Public API only. Internal helpers prefixed with `_`.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import prisma from '../prisma.js';

const PASSWORD_SALT_ROUNDS = 8;
const MAX_TOKENS_PER_USER = 2;
const JWT_EXPIRES_IN = '7d';

const PUBLIC_USER_FIELDS = {
    id: true,
    name: true,
    displayName: true,
    email: true,
    emailVerified: true,
    role: true,
    isOnline: true,
    location: true,
    banned: true,
    tosAccepted: true,
    theme: true,
    geoData: true,
    createdAt: true,
    updatedAt: true,
};

/**
 * Strip sensitive fields (password) for client responses.
 * Mongoose did this via toJSON transform.
 */
export function toPublicJSON(user) {
    if (!user) return null;
    const { password, tokens, ...safe } = user;
    return safe;
}

export async function findById(id) {
    if (!id || typeof id !== 'string') return null;
    return prisma.user.findUnique({ where: { id } });
}

export async function findByEmail(email) {
    if (!email) return null;
    return prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
    });
}

export async function findByName(name) {
    if (!name) return null;
    return prisma.user.findUnique({ where: { name } });
}

/**
 * Returns user only if a matching token exists for them.
 * Replaces: User.findOne({ _id: userId, "tokens.token": token })
 */
export async function findByIdWithToken(userId, token) {
    if (!userId || !token) return null;
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            tokens: { some: { token } },
        },
    });
    return user;
}

export async function existsByEmailOrName({ email, name }) {
    return prisma.user.findFirst({
        where: {
            OR: [
                email ? { email: email.toLowerCase().trim() } : undefined,
                name ? { name } : undefined,
            ].filter(Boolean),
        },
    });
}

/**
 * Create a user with hashed password.
 * Replaces: new User({...}).save() + pre('save') hash hook.
 */
export async function create({ name, email, password, role = 'GUEST', tosAccepted = false, theme = {} }) {
    if (!email || !validator.isEmail(email)) {
        throw new Error('Invalid Email address');
    }
    if (!password || password.length < 3) {
        throw new Error('Password too short');
    }

    const hashed = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

    return prisma.user.create({
        data: {
            name,
            email: email.toLowerCase().trim(),
            password: hashed,
            role,
            tosAccepted,
            theme: theme && Object.keys(theme).length > 0
                ? theme
                : undefined, // fall back to schema default
        },
    });
}

/**
 * Login with credentials. Replaces User.findByCredentials.
 * Returns the user document or throws an Error.
 */
export async function findByCredentials(email, password) {
    if (!email || !password) {
        throw new Error('Unable to login - Invalid credentials');
    }
    const user = await findByEmail(email);
    if (!user) {
        throw new Error('Unable to login - Invalid credentials');
    }
    if (user.banned) {
        throw new Error('Account is banned');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        throw new Error('Unable to login - Invalid credentials');
    }
    return user;
}

/**
 * Issue a JWT, persist it as a UserToken row, enforce max-tokens-per-user FIFO.
 * Replaces User.generateAuthToken(device).
 */
export async function issueToken(userId, device = 'web') {
    if (!process.env.JWT_KEY) {
        throw new Error('JWT_KEY is not defined in environment variables');
    }

    const user = await findById(userId);
    if (!user) throw new Error('User not found');

    const token = jwt.sign(
        { _id: user.id, email: user.email },
        process.env.JWT_KEY,
        { expiresIn: JWT_EXPIRES_IN }
    );

    await prisma.$transaction(async (tx) => {
        // FIFO: drop oldest if at limit
        const existing = await tx.userToken.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
        const overflow = existing.length - (MAX_TOKENS_PER_USER - 1);
        if (overflow > 0) {
            const idsToDrop = existing.slice(0, overflow).map(t => t.id);
            await tx.userToken.deleteMany({ where: { id: { in: idsToDrop } } });
        }
        await tx.userToken.create({
            data: { userId, token, device }
        });
    });

    return token;
}

/**
 * Update arbitrary user fields. Whitelisted to prevent accidental writes to
 * password / id / system columns.
 */
const UPDATABLE_FIELDS = new Set([
    'name', 'displayName', 'email', 'emailVerified', 'role',
    'isOnline', 'location', 'banned', 'tosAccepted', 'theme', 'geoData'
]);

export async function update(id, data) {
    const sanitized = {};
    for (const [k, v] of Object.entries(data || {})) {
        if (UPDATABLE_FIELDS.has(k)) sanitized[k] = v;
    }
    if (Object.keys(sanitized).length === 0) return findById(id);
    return prisma.user.update({ where: { id }, data: sanitized });
}

export async function setOnline(id, isOnline) {
    if (!id) return null;
    return prisma.user.update({
        where: { id },
        data: { isOnline },
    });
}

export async function remove(id) {
    return prisma.user.delete({ where: { id } });
}

export const userRepo = {
    findById,
    findByEmail,
    findByName,
    findByIdWithToken,
    existsByEmailOrName,
    create,
    findByCredentials,
    issueToken,
    update,
    setOnline,
    remove,
    toPublicJSON,
    PUBLIC_USER_FIELDS,
};

export default userRepo;
