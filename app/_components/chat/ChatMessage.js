import {
    Box
} from '@mui/material';

//app imports
import ChatMessageContent from '@/app/_components/chat/ChatMessageContent';
import ChatMessageFromUser from '@/app/_components/chat/ChatMessageFromUser';
import ChatMessageAgentDebug from '@/app/_components/chat/ChatMessageAgentDebug';
import EdifactAnalysisPanel from '@/app/_components/chat/EdifactAnalysisPanel';

function ChatMessage({ message, sessionId }) {
    const messageAnalysis = message.domainContext?.edifact?._analysis;

    const renderAssistantMessage = () => {
        const content = typeof message.content === 'string'
            ? { text: message.content }
            : message.content;
        
        return (
            <Box>
                {/* Agent Debug Info (Plan, Steps, Reasoning) */}
                {content.agentPlan && (
                    <ChatMessageAgentDebug 
                        currentAgentState={null} 
                        message={message}
                    />
                )}
                
                {/* Main Response */}
                <ChatMessageContent
                    content={content}
                    sessionId={sessionId}
                    messageId={message.id || content.id}
                />
            </Box>
        );
    };

    if (message.role === 'user') {
        return (
            <Box>
                <ChatMessageFromUser content={message.content} />
                {messageAnalysis && <EdifactAnalysisPanel analysis={messageAnalysis} />}
            </Box>
        );
    }

    return renderAssistantMessage();
}

export default ChatMessage;
