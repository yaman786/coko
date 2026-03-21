import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LoginForm } from '../features/auth/components/LoginForm';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
    lockedTo?: 'retail' | 'wholesale';
}

export function LoginPage({ lockedTo }: LoginPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { session, loading, role } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Initial intent from URL or default to retail
    const getInitialIntent = () => {
        if (lockedTo) return lockedTo;
        const to = searchParams.get('to') as 'retail' | 'wholesale';
        if (to === 'retail' || to === 'wholesale') return to;
        
        // Fallback to cookie check if URL is empty
        const match = document.cookie.match(/(^| )portal_intent=([^;]+)/);
        return match ? (match[2] as 'retail' | 'wholesale') : 'retail';
    };

    const [targetApp, setTargetAppState] = useState<'retail' | 'wholesale'>(() => getInitialIntent());

    usePageTitle(targetApp === 'retail' ? 'Coko Login' : 'GOD HUB Login');

    // Automatic Redirection once session is established
    useEffect(() => {
        if (!loading && session && role) {
            console.log("Auth State Ready:", { targetApp, role, hasSession: !!session });
            // Determine destination
            if (targetApp === 'wholesale' && role === 'admin') {
                console.log("Redirecting to Wholesale Dashboard...");
                navigate('/wholesale/dashboard', { replace: true });
            } else {
                console.log("Redirecting to Retail POS...");
                navigate('/pos', { replace: true });
            }
        }
    }, [session, loading, role, targetApp, navigate]);

    const setTargetApp = (val: 'retail' | 'wholesale') => {
        setTargetAppState(val);
        setSearchParams({ to: val }, { replace: true });
        document.cookie = `portal_intent=${val}; path=/; max-age=86400; SameSite=Lax`;
    };

    const handleLogin = async (email: string, password: string) => {
        if (!email || !password) {
            toast.error("Required Fields", { description: "Please enter both email and password." });
            return;
        }

        setIsLoading(true);

        try {
            // Persist intent before signing in
            document.cookie = `portal_intent=${targetApp}; path=/; max-age=86400; SameSite=Lax`;

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                toast.error("Authentication Failed", { description: error.message });
                setIsLoading(false);
            } else {
                toast.success("Welcome Back", { 
                    description: `Accessing ${targetApp === 'retail' ? 'Coko Boutique' : 'GOD Warehouse'}...` 
                });
            }
        } catch (err) {
            toast.error("Network Error", { description: "Could not connect to authentication server." });
            setIsLoading(false);
        }
    };

    if (!loading && session) {
        return <PageLoader />;
    }

    return (
        <LoginForm 
            onLogin={handleLogin} 
            isLoading={isLoading} 
            targetApp={targetApp} 
            setTargetApp={setTargetApp} 
            locked={!!lockedTo}
        />
    );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      <p className="text-sm text-slate-400 font-medium tracking-tight">Accessing Portal...</p>
    </div>
  );
}
