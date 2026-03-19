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
    const { session, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    // Check localStorage for previous intent, default to retail
    const [targetApp, setTargetAppState] = useState<'retail' | 'wholesale'>(() => {
        try {
            return (localStorage.getItem('portal_intent') as 'retail' | 'wholesale') || 'retail';
        } catch {
            return 'retail';
        }
    });

    const setTargetApp = (val: 'retail' | 'wholesale') => {
        setTargetAppState(val);
        try {
            localStorage.setItem('portal_intent', val);
        } catch { /* ignore */ }
    };

    // Redirect if already logged in
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
            // Ensure intent is saved before login
            localStorage.setItem('portal_intent', targetApp);

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
            }
        } catch (err) {
            toast.error("Network Error", { description: "Could not connect to authentication server." });
            console.error('Unexpected error:', err);
            setIsLoading(false);
        }
    };

    // Show redirecting state if authenticated
    if (!loading && session) {
        return <PageLoader />;
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

function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      <p className="text-sm text-slate-400 font-medium tracking-tight">Redirecting...</p>
    </div>
  );
}
