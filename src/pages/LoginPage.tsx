import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../features/auth/components/LoginForm';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
    usePageTitle('Login');
    const navigate = useNavigate();
    const { session, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [targetApp, setTargetApp] = useState<'retail' | 'wholesale'>('retail');

    // KEY FIX: If user already has a session (or just logged in), redirect them
    // This catches the race condition where onAuthStateChange fires before navigate()
    useEffect(() => {
        if (!loading && session) {
            let portal = 'retail';
            try { portal = sessionStorage.getItem('god-portal') || 'retail'; } catch { /* ignore */ }
            
            if (portal === 'wholesale') {
                navigate('/wholesale', { replace: true });
            } else {
                navigate('/pos', { replace: true });
            }
        }
    }, [session, loading, navigate]);

    const handleLogin = async (email: string, password: string) => {
        if (!email || !password) {
            toast.error("Required Fields", { description: "Please enter both email and password." });
            return;
        }

        // Persist portal choice BEFORE login so it survives the auth state change
        try { sessionStorage.setItem('god-portal', targetApp); } catch { /* ignore */ }

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
                toast.success("Welcome Back", { description: `Logged into ${targetApp === 'retail' ? 'Coko Boutique' : 'GOD Warehouse'}` });
                // The useEffect above will handle the redirect once session updates
            }
        } catch (err) {
            toast.error("Network Error", { description: "Could not connect to authentication server." });
            console.error('Unexpected error:', err);
            setIsLoading(false);
        }
    };

    // Don't show login form if already authenticated (prevents flash)
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
