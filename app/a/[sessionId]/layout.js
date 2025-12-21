
export async function generateMetadata({ params }) {
    const { sessionId } = await params
    console.log("sessionId in layout metadata:", sessionId);
    return {
        title: "chat",
        description: "TODO"
    }
}

export default async function AnalysisChatLayout({ children, params }) {
    const { sessionId } = await params;
    console.log("sessionId in layout:", sessionId);
    return children;
}