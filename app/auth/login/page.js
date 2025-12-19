import LoginContainer from '@/app/_containers/LoginContainer';

export const metadata = {
    title: 'Login',
    description: 'Access your account to manage your EDIFACT data',
};

function LoginPage() {
    return <LoginContainer />;
}

export default LoginPage;