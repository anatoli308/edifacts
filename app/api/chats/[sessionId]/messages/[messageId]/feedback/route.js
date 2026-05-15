import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { chatRepo, feedbackRepo, prisma } from '@/lib/db/repositories';

/**
 * Feedback endpoint for AnalysisMessage thumbs up / down.
 *
 *   POST   { rating: 1 | -1, comment?, retrievedChunkIds? }  toggle / upsert
 *   GET                                                       current user rating
 *   DELETE                                                    explicit clear
 *
 * Toggle-off: posting the same rating twice deletes the row.
 *
 * Note (future): when rating === 1 we can enqueue an LLM-driven fact
 * extraction that calls Memory.remember() with the distilled user
 * preference. Deferred until enough like-data exists to learn from.
 */

const _auth = async (request) => {
    const userId = request.headers.get('x-user-id');
    const token = request.headers.get('x-auth-token');
    return getAuthenticatedUser(userId, token);
};

const _resolveMessage = async (sessionId, messageId, userId) => {
    const chat = await chatRepo.findByIdAndOwner(sessionId, userId);
    if (!chat) return { error: 'Chat not found or access denied', status: 404 };

    const message = await prisma.analysisMessage.findUnique({
        where: { id: messageId },
        select: { id: true, chatId: true, role: true },
    });
    if (!message || message.chatId !== sessionId) {
        return { error: 'Message not found', status: 404 };
    }
    // Only assistant turns are rateable.
    if (message.role !== 'assistant') {
        return { error: 'Only assistant messages can be rated', status: 400 };
    }
    return { message };
};

export async function POST(request, { params }) {
    try {
        const { sessionId, messageId } = await params;
        const user = await _auth(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const resolved = await _resolveMessage(sessionId, messageId, user.id);
        if (resolved.error) {
            return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        }

        const body = await request.json().catch(() => ({}));
        const rating = Number(body?.rating);
        if (rating !== 1 && rating !== -1) {
            return NextResponse.json(
                { error: 'rating must be 1 (like) or -1 (dislike)' },
                { status: 400 }
            );
        }

        const result = await feedbackRepo.setRating({
            messageId,
            userId: user.id,
            rating,
            comment: typeof body?.comment === 'string' ? body.comment : '',
            retrievedChunkIds: Array.isArray(body?.retrievedChunkIds) ? body.retrievedChunkIds : [],
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('[API /feedback POST] Error:', error);
        return NextResponse.json({ error: 'Failed to set feedback' }, { status: 500 });
    }
}

export async function GET(request, { params }) {
    try {
        const { sessionId, messageId } = await params;
        const user = await _auth(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const resolved = await _resolveMessage(sessionId, messageId, user.id);
        if (resolved.error) {
            return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        }

        const feedback = await feedbackRepo.get({ messageId, userId: user.id });
        return NextResponse.json({
            rating: feedback?.rating ?? null,
            feedback: feedback ?? null,
        });
    } catch (error) {
        console.error('[API /feedback GET] Error:', error);
        return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { sessionId, messageId } = await params;
        const user = await _auth(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const resolved = await _resolveMessage(sessionId, messageId, user.id);
        if (resolved.error) {
            return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        }

        const result = await feedbackRepo.remove({ messageId, userId: user.id });
        return NextResponse.json(result);
    } catch (error) {
        console.error('[API /feedback DELETE] Error:', error);
        return NextResponse.json({ error: 'Failed to remove feedback' }, { status: 500 });
    }
}
