import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { api } from '../services/api';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    role: 'admin' | 'cashier' | null;
    loading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    role: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'admin' | 'cashier' | null>(null);
    const [loading, setLoading] = useState(true);

    const envStatus = {
        hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
        hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY
    };

    const handleSessionRefresh = async (session: Session | null) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser?.email) {
            // -- MASTER REDIRECTION LOGIC --
            // This is the source of truth for portal landing.
            try {
                const match = document.cookie.match(/(^| )portal_intent=([^;]+)/);
                const intent = match ? match[2] : null;

                if (intent) {
                    // Clear cookie immediately
                    document.cookie = "portal_intent=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                    
                    const currentPath = window.location.pathname;
                    if (intent === 'wholesale' && !currentPath.startsWith('/wholesale')) {
                        console.log('[AuthContext] Forcing redirect to Wholesale Dashboard');
                        window.location.replace('/wholesale/dashboard');
                        return; // Prevent further state updates during redirect
                    } else if (intent === 'retail' && !currentPath.startsWith('/pos')) {
                        console.log('[AuthContext] Forcing redirect to Retail POS');
                        window.location.replace('/pos');
                        return;
                    }
                }
            } catch (e) { /* ignore */ }

            try {
                // Fetch staff profile from database — role is determined ONLY from the staff table
                const staff = await api.getStaff(true);
                const staffRecord = staff.find(s => s.email === currentUser.email);

                // Normalizing to lowercase for robust role checking
                const rawRole = staffRecord?.role ?? 'cashier';
                setRole(rawRole.toLowerCase() as 'admin' | 'cashier');
            } catch (err) {
                console.error("Failed to fetch staff role from API:", err);
                setRole('cashier'); // Fallback to least privilege
            }
        } else {
            setRole(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const timeoutId = setTimeout(() => {
            if (isMounted && loading) {
                console.warn("Auth initialization timed out (5s).");
                setLoading(false);
            }
        }, 5000);

        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (isMounted) {
                    clearTimeout(timeoutId);
                    handleSessionRefresh(session);
                }
            })
            .catch(err => {
                console.error("Critical Auth initialization error:", err);
                if (isMounted) {
                    clearTimeout(timeoutId);
                    setLoading(false);
                }
            });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (isMounted) {
                handleSessionRefresh(session);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(timeoutId);
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
            {loading ? (
                <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] p-4 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                    <p className="text-slate-600 font-medium">Initializing Coko POS...</p>
                    <div className="mt-8 p-4 bg-white rounded-lg border border-slate-200 shadow-sm max-w-xs text-xs text-slate-400 space-y-1">
                        <p>Environmental Check:</p>
                        <p className={envStatus.hasUrl ? "text-emerald-500" : "text-rose-500"}>
                            Database Connection: {envStatus.hasUrl ? "Present" : "MISSING"}
                        </p>
                        <p className={envStatus.hasKey ? "text-emerald-500" : "text-rose-500"}>
                            Auth Handshake: {envStatus.hasKey ? "Present" : "MISSING"}
                        </p>
                    </div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    return useContext(AuthContext);
};
