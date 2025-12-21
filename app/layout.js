import { Roboto } from 'next/font/google';
import Script from 'next/script';

//app imports
import Providers from '@/app/_contexts/providers';
import SplashScreen from '@/app/_components/SplashScreen';
import DefaultAppBar from '@/app/_components/DefaultAppBar';

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

export default function RootLayout({ children }) {
    return (
        <html lang="en" className={roboto.className}>
            <body>
                <Providers>
                    <SplashScreen>
                        <DefaultAppBar>
                            {children}
                        </DefaultAppBar>
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