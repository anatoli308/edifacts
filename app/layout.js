import { Roboto } from 'next/font/google';
import Script from 'next/script';
import { headers } from 'next/headers';

//app imports
import Providers from '@/app/_contexts/providers';
import SplashScreen from '@/app/_components/SplashScreen';
import AppLayout from '@/app/_components/AppLayout';

import { getAuthenticatedUser, getAnalysisChatsForUser } from '@/lib/auth';

const roboto = Roboto({
    weight: ["300", "400", "500", "700"],
    subsets: ['latin'],
    display: 'swap',
});

export const metadata = {
    title: {
        template: '%s / EDIFACTS',
        default: 'EDIFACTS',
    },
    description: {
        template: '%s',
        default: 'Read your EDIFACT data easily online',
    },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION || '' },
    icons: { icon: '/logo/logo-color-no-bg.png' }
}

//TODO eventuell authenticatedUser aus Server Component holen und in Context packen,
//  damit es in SplashScreen und AppLayout verfügbar ist (und nicht erst in ChatPage)

export default async function RootLayout({ children }) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    const token = headersList.get('x-auth-token');
    const authenticatedUser = await getAuthenticatedUser(userId, token);
    const analysisChats = authenticatedUser ? await getAnalysisChatsForUser(authenticatedUser) : [];
    console.log("count of analysis chats for user in RootLayout:", analysisChats.length);
    return (
        <html lang="en" className={roboto.className}>
            <body>
                <Providers>
                    <SplashScreen>
                        <AppLayout analysisChats={analysisChats}>
                            {children}
                        </AppLayout>
                    </SplashScreen>
                </Providers>
            </body>

            <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.GOOGLE_TAG_MANAGER_ID || ''}`}
                strategy="lazyOnload" />
            <Script id="google-analytics-tag" strategy="lazyOnload" dangerouslySetInnerHTML={{
                __html: `
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${process.env.GOOGLE_TAG_MANAGER_ID || ''}');
                `
            }} />
        </html>
    );
}