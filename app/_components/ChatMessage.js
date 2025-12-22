import {
    Box
} from '@mui/material';

//app imports
import ChatMessageContent from '@/app/_components/ChatMessageContent';
import ChatMessageFromUser from '@/app/_components/ChatMessageFromUser';
import ChatMessageReasoning from '@/app/_components/ChatMessageReasoning';
import ChatMessageSteps from '@/app/_components/ChatMessageSteps';
import ChatMessageToolCalls from '@/app/_components/ChatMessageToolCalls';

function ChatMessage({ message }) {

    const renderAssistantMessage = () => {
        const content = typeof message.content === 'string'
            ? { text: message.content }
            : message.content;

        return (
            <Box sx={{ mb: 2 }}>
                {/* Reasoning Section */}
                {content.reasoning && (
                    <ChatMessageReasoning
                        reasoning={content.reasoning}
                    />
                )}

                {/* Steps Section */}
                {content.steps && content.steps.length > 0 && (
                    <ChatMessageSteps
                        steps={content.steps}
                    />
                )}

                {/* Tool Calls Section */}
                {content.toolCalls && content.toolCalls.length > 0 && (
                    <ChatMessageToolCalls
                        toolCalls={content.toolCalls}
                    />
                )}

                {/* Main Response */}
                <ChatMessageContent
                    content={content}
                    status={content.status}
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
