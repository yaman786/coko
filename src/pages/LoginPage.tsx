import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../features/auth/components/LoginForm';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { usePageTitle } from '../hooks/usePageTitle';

export function LoginPage() {
    usePageTitle('Login');
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (email: string, password: string) => {
        if (!email || !password) {
            toast.error("Required Fields", { description: "Please enter both email and password." });
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                toast.error("Authentication Failed", { description: error.message });
                console.error('Login error:', error.message);
            } else {
                toast.success("Welcome Back", { description: "You have successfully logged in." });
                navigate('/');
            }
        } catch (err) {
            toast.error("Network Error", { description: "Could not connect to authentication server." });
            console.error('Unexpected error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return <LoginForm onLogin={handleLogin} isLoading={isLoading} />;
}
