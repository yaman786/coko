import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoginForm } from '../features/auth/components/LoginForm';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
    usePageTitle('Login');
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { session, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    // Sync state with URL parameter 'to'
    const targetApp = (searchParams.get('to') as 'retail' | 'wholesale') || 'retail';

    const setTargetApp = (val: 'retail' | 'wholesale') => {
        setSearchParams({ to: val }, { replace: true });
    };

    // Redirect if already logged in (Industry Standard: handle intent in useEffect)
    useEffect(() => {
        if (!loading && session) {
            if (targetApp === 'wholesale') {
                navigate('/wholesale', { replace: true });
            } else {
                navigate('/pos', { replace: true });
            }
        }
    }, [session, loading, navigate, targetApp]);

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
                setIsLoading(false);
            } else {
                toast.success("Welcome Back", { 
                    description: `Logged into ${targetApp === 'retail' ? 'Coko Boutique' : 'GOD Warehouse'}` 
                });
                // Note: The useEffect above will catch the session update and perform the redirect
            }
        } catch (err) {
            toast.error("Network Error", { description: "Could not connect to authentication server." });
            console.error('Unexpected error:', err);
            setIsLoading(false);
        }
    };

    // Don't flash the login form if already authenticated
    if (!loading && session) {
        return null;
    }

    return (
        <LoginForm 
            onLogin={handleLogin} 
            isLoading={isLoading} 
            targetApp={targetApp} 
            setTargetApp={setTargetApp} 
        />
    );
}
