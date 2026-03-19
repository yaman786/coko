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
            const intent = localStorage.getItem('portal_intent') as 'retail' | 'wholesale';
            console.log('[LoginPage] Initial intent from localStorage:', intent);
            return intent || 'retail';
        } catch {
            return 'retail';
        }
    });

    const setTargetApp = (val: 'retail' | 'wholesale') => {
        console.log('[LoginPage] Setting targetApp toggle:', val);
        setTargetAppState(val);
        try {
            localStorage.setItem('portal_intent', val);
        } catch (err) {
            console.error('[LoginPage] Failed to save intent to localStorage:', err);
        }
    };

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && session) {
            console.log('[LoginPage] Session detected, taking action. targetApp:', targetApp);
            if (targetApp === 'wholesale') {
                console.log('[LoginPage] Navigating to /wholesale');
                navigate('/wholesale', { replace: true });
            } else {
                console.log('[LoginPage] Navigating to /pos');
                navigate('/pos', { replace: true });
            }
        }
    }, [session, loading, navigate, targetApp]);

    const handleLogin = async (email: string, password: string) => {
        console.log('[LoginPage] handleLogin called', { email, targetApp });
        if (!email || !password) {
            toast.error("Required Fields", { description: "Please enter both email and password." });
            return;
        }

        setIsLoading(true);

        try {
            // Ensure intent is saved
            console.log('[LoginPage] Saving intent:', targetApp);
            localStorage.setItem('portal_intent', targetApp);

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('[LoginPage] SignIn Error:', error.message);
                toast.error("Authentication Failed", { description: error.message });
                setIsLoading(false);
            } else {
                console.log('[LoginPage] SignIn Success, forcing redirect to:', targetApp);
                toast.success("Welcome Back", { 
                    description: `Redirecting to ${targetApp === 'retail' ? 'Coko Boutique' : 'GOD Warehouse'}...` 
                });
                
                // Deterministic "Nuclear Option": Force browser navigation
                // This bypasses React Router race conditions and Supabase defaults
                if (targetApp === 'wholesale') {
                    window.location.href = '/wholesale';
                } else {
                    window.location.href = '/pos';
                }
            }
        } catch (err) {
            console.error('[LoginPage] Unexpected Error during SignIn:', err);
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
