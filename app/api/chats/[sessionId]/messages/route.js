import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { chatRepo } from '@/lib/db/repositories';
import { loadChatMessagesPaginated } from '@/lib/messageHelpers';

/**
 * GET /api/chats/[sessionId]/messages
 * Load all messages for a chat session
 *
 * Query Params:
 * - limit: messages per page (default 100)
 * - page: page number (default 1)
 */
export async function GET(request, { params }) {
    try {
        const { sessionId } = params;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page')) || 1;
        const pageSize = parseInt(searchParams.get('limit')) || 100;

        const userId = request.headers.get('x-user-id');
        const token = request.headers.get('x-auth-token');
        const authenticatedUser = await getAuthenticatedUser(userId, token);
        if (!authenticatedUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const chat = await chatRepo.findByIdAndOwner(sessionId, authenticatedUser.id);
        if (!chat) {
            return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
        }

        const result = await loadChatMessagesPaginated(sessionId, page, pageSize);
        return NextResponse.json({ sessionId, ...result });

    } catch (error) {
        console.error('[API /chats/:sessionId/messages] Error:', error);
        return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }
}
