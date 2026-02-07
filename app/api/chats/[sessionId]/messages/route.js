import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import AnalysisChat from '@/models/edifact/AnalysisChat';
import { loadChatMessagesPaginated } from '@/lib/helpers/messageHelpers';

/**
 * GET /api/chats/[sessionId]/messages
 * Load all messages for a chat session
 * 
 * Query Params:
 * - limit: Max number of messages (optional, default: 100)
 * - page: Page number (optional, default: 1)
 */
export async function GET(request, { params }) {
    try {
        await dbConnect();

        const { sessionId } = params;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page')) || 1;
        const pageSize = parseInt(searchParams.get('limit')) || 100;

        // Authenticate user
        const authenticatedUser = await getAuthenticatedUser(request);
        if (!authenticatedUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Verify user owns this chat
        const chat = await AnalysisChat.findOne({
            _id: sessionId,
            creatorId: authenticatedUser._id
        }).lean();

        if (!chat) {
            return NextResponse.json(
                { error: 'Chat not found or access denied' },
                { status: 404 }
            );
        }

        // Verwende Helper-Funktion für paginierte Messages
        const result = await loadChatMessagesPaginated(sessionId, page, pageSize);

        return NextResponse.json({
            sessionId,
            ...result
        });

    } catch (error) {
        console.error('[API /chats/:sessionId/messages] Error:', error);
        return NextResponse.json(
            { error: 'Failed to load messages' },
            { status: 500 }
        );
    }
}
