import { useState } from 'react';
import { LoginForm } from '../features/auth/components/LoginForm';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
    usePageTitle('Login');
    const { session, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    // Cookie helpers for portal intent
    const setIntent = (val: string) => {
        document.cookie = `portal_intent=${val}; path=/; max-age=600; SameSite=Lax`;
    };

    const getIntent = () => {
        const match = document.cookie.match(/(^| )portal_intent=([^;]+)/);
        return match ? (match[2] as 'retail' | 'wholesale') : 'retail';
    };

    const [targetApp, setTargetAppState] = useState<'retail' | 'wholesale'>(() => getIntent());

    const setTargetApp = (val: 'retail' | 'wholesale') => {
        setTargetAppState(val);
        setIntent(val);
    };

    const handleLogin = async (email: string, password: string) => {
        if (!email || !password) {
            toast.error("Required Fields", { description: "Please enter both email and password." });
            return;
        }

        setIsLoading(true);

        try {
            // Save intent as cookie
            setIntent(targetApp);

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                toast.error("Authentication Failed", { description: error.message });
                setIsLoading(false);
            } else {
                toast.success("Welcome Back", { 
                    description: `Redirecting to ${targetApp === 'retail' ? 'Coko Boutique' : 'GOD Warehouse'}...` 
                });
            }
        } catch (err) {
            toast.error("Network Error", { description: "Could not connect to authentication server." });
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
