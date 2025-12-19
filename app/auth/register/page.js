import RegisterContainer from '@/app/_containers/RegisterContainer';

export const metadata = {
    title: 'Register',
    description: 'Create a new account to start managing your EDIFACT data',
};

function RegisterPage() {
    return <RegisterContainer />;
}

export default RegisterPage;