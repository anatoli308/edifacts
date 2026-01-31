import {
    Box
} from '@mui/material';

//app imports
import ChatMessageContent from '@/app/_components/chat/ChatMessageContent';
import ChatMessageFromUser from '@/app/_components/chat/ChatMessageFromUser';
import ChatMessageAgentDebug from '@/app/_components/chat/ChatMessageAgentDebug';

function ChatMessage({ message }) {

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
                />
            </Box>
        );
    };

    if (message.role === 'user') {
        return <ChatMessageFromUser content={message.content} />;
    }

    return renderAssistantMessage();
}

export default ChatMessage;
