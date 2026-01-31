import {
    Box
} from '@mui/material';

//app imports
import ChatMessageContent from '@/app/_components/chat/ChatMessageContent';
import ChatMessageFromUser from '@/app/_components/chat/ChatMessageFromUser';

function ChatMessage({ message }) {

    const renderAssistantMessage = () => {
        const content = typeof message.content === 'string'
            ? { text: message.content }
            : message.content;
        {/* Main Response */ }
        return (
            <ChatMessageContent
                content={content}
            />
        );
    };

    if (message.role === 'user') {
        return <ChatMessageFromUser content={message.content} />;
    }

    return renderAssistantMessage();
}

export default ChatMessage;
