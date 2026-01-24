import AnalysisChatPage from '@/app/_containers/AnalysisChatPage';

export default async function AnalysisChat(props) {
    const { sessionId } = await props.params
    console.log("sessionId in page:", sessionId);
    return <AnalysisChatPage sessionId={sessionId} />;
}