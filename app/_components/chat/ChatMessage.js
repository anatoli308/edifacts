import {
    Box
} from '@mui/material';

//app imports
import ChatMessageContent from '@/app/_components/chat/ChatMessageContent';
import ChatMessageFromUser from '@/app/_components/chat/ChatMessageFromUser';
import ChatMessageReasoning from '@/app/_components/chat/ChatMessageReasoning';
import ChatMessageSteps from '@/app/_components/chat/ChatMessageSteps';
import ChatMessageToolCalls from '@/app/_components/chat/ChatMessageToolCalls';

const display = false; //TODO: for now we not use/display reasoning, steps, tool calls in the UI

function ChatMessage({ message }) {

    const renderAssistantMessage = () => {
        const content = typeof message.content === 'string'
            ? { text: message.content }
            : message.content;

        return (
            <Box sx={{ mb: 2 }}>
                {/* Reasoning Section */}
                {display && content.reasoning && (
                    <ChatMessageReasoning
                        reasoning={content.reasoning}
                    />
                )}

                {/* Steps Section */}
                {display && content.steps && content.steps.length > 0 && (
                    <ChatMessageSteps
                        steps={content.steps}
                    />
                )}

                {/* Tool Calls Section */}
                {display && content.toolCalls && content.toolCalls.length > 0 && (
                    <ChatMessageToolCalls
                        toolCalls={content.toolCalls}
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
