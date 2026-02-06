import AnalysisChatPage from '@/app/_containers/AnalysisChatPage';
import { headers } from 'next/headers';

import { getAnalysisChat, getAuthenticatedUser } from '@/lib/auth';

export default async function AnalysisChat(props) {
    const { sessionId } = await props.params
    console.log("try sessionId in page:", sessionId);
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const token = headersList.get('x-auth-token');
    const authenticatedUser = await getAuthenticatedUser(userId, token);
    const chat = await getAnalysisChat(sessionId, authenticatedUser);
    return <AnalysisChatPage analysisChat={chat} />;
}