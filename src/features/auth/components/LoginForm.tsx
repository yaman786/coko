import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
// Unused card imports removed
import { IceCream, Lock, Mail, ArrowLeft, Loader2, Warehouse, Truck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

interface LoginFormProps {
    onLogin: (email: string, password: string) => void;
    isLoading?: boolean;
    targetApp: 'retail' | 'wholesale';
    setTargetApp: (val: 'retail' | 'wholesale') => void;
    locked?: boolean;
}

export function LoginForm({ onLogin, isLoading = false, targetApp, setTargetApp, locked = false }: LoginFormProps) {
    // Robustly check if we are on a dedicated portal login path
    const isDedicatedPath = typeof window !== 'undefined' && (window.location.pathname === '/pos/login' || window.location.pathname === '/wholesale/login');
    const isLocked = locked || isDedicatedPath;
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    const isRetail = targetApp === 'retail';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(email, password);
    };

    const handleForgotPassword = async () => {
        if (!resetEmail) {
            toast.error("Email Required", { description: "Please enter your email address." });
            return;
        }
        setIsResetting(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) {
                toast.error("Reset Failed", { description: error.message });
            } else {
                toast.success("Reset Link Sent!", { description: "Check your email inbox for the password reset link." });
                setShowForgotPassword(false);
                setResetEmail('');
            }
        } catch {
            toast.error("Error", { description: "Could not send reset link." });
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className={`h-[100dvh] w-full flex flex-col transition-colors duration-500 ${isRetail ? 'bg-gradient-to-br from-[#fdf2f8] via-[#f5f3ff] to-[#eff6ff]' : 'bg-gradient-to-br from-slate-100 via-blue-100 to-sky-100'} overflow-hidden relative`}>
            {/* Ambient Background Elements */}
            <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 ${isRetail ? 'bg-pink-400' : 'bg-blue-400'}`} />
            <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 ${isRetail ? 'bg-purple-400' : 'bg-sky-400'}`} />

            <div className="flex-1 flex items-center justify-center p-6 relative z-10">
                <div className="w-full max-w-md shrink-0">
                    <div className="bg-white/40 backdrop-blur-3xl border border-white/60 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden">
                        <div className="p-8 md:p-10 space-y-8">
                            {/* Portal Toggle */}
                            {!isLocked && (
                                <div className="flex p-1.5 bg-slate-200/40 backdrop-blur-md rounded-full border border-slate-200/50 shadow-inner">
                                    <button 
                                        onClick={() => setTargetApp('retail')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${isRetail ? 'bg-white text-pink-600 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        <IceCream className="w-3.5 h-3.5" />
                                        Retail
                                    </button>
                                    <button 
                                        onClick={() => setTargetApp('wholesale')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${!isRetail ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        <Warehouse className="w-3.5 h-3.5" />
                                        GOD
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col items-center gap-4">
                                <div className={`relative w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-all duration-700 transform hover:scale-105 ${isRetail ? 'bg-gradient-to-br from-pink-500 to-purple-600 rotate-0' : 'bg-gradient-to-br from-blue-600 to-sky-700 rotate-180'}`}>
                                    <div className="transform transition-transform duration-700" style={{ transform: isRetail ? 'rotate(0deg)' : 'rotate(-180deg)' }}>
                                        {isRetail ? (
                                            <IceCream className="w-12 h-12 text-white" />
                                        ) : (
                                            <Truck className="w-12 h-12 text-white" />
                                        )}
                                    </div>
                                    <div className="absolute inset-0 rounded-[2rem] border-[3px] border-white/20" />
                                </div>

                                <div className="text-center">
                                    <h1 className="text-4xl font-black tracking-tight font-['DM_Sans',sans-serif] mb-1">
                                        {isRetail ? (
                                            <span className="text-slate-800 uppercase tracking-tighter">Coko <span className="text-pink-600">Boutique</span></span>
                                        ) : (
                                            <span className="text-slate-800 uppercase tracking-tighter">GOD <span className="text-blue-600">Hub</span></span>
                                        )}
                                    </h1>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 font-['DM_Sans',sans-serif]">
                                        {isRetail ? 'Premium Ice Cream POS' : 'Global Distribution Network'}
                                    </p>
                                </div>
                            </div>

                            {showForgotPassword ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                                    <button
                                        onClick={() => setShowForgotPassword(false)}
                                        className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isRetail ? 'text-pink-600 hover:text-pink-800' : 'text-blue-600 hover:text-blue-800'}`}
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Return to Access
                                    </button>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="reset-email" className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Recovery Email</Label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                                <Input
                                                    id="reset-email"
                                                    type="email"
                                                    placeholder="admin@coko.com"
                                                    value={resetEmail}
                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                    className="pl-12 h-14 bg-white/60 border-white/40 focus:bg-white transition-all rounded-2xl shadow-inner font-['DM_Sans',sans-serif]"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            onClick={handleForgotPassword}
                                            disabled={isResetting}
                                            className={`w-full h-14 text-white shadow-2xl text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 transform active:scale-[0.98] ${isRetail ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-pink-500/20' : 'bg-gradient-to-r from-blue-600 to-sky-700 hover:shadow-blue-600/20'}`}
                                        >
                                            {isResetting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Initiate Recovery"}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-['DM_Sans',sans-serif] ml-1">Identity</Label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder={isRetail ? "admin@coko.com" : "manager@god.com"}
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="pl-12 h-14 bg-white/60 border-white/40 focus:bg-white transition-all rounded-2xl shadow-inner focus:ring-4 focus:ring-purple-500/10 font-['DM_Sans',sans-serif]"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center ml-1">
                                                <Label htmlFor="password" className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-['DM_Sans',sans-serif]">Security Key</Label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowForgotPassword(true)}
                                                    className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isRetail ? 'text-pink-500 hover:text-pink-700' : 'text-blue-500 hover:text-blue-700'}`}
                                                >
                                                    Forgotten?
                                                </button>
                                            </div>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    placeholder="••••••••"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="pl-12 h-14 bg-white/60 border-white/40 focus:bg-white transition-all rounded-2xl shadow-inner focus:ring-4 focus:ring-purple-500/10 font-['DM_Sans',sans-serif] tracking-widest"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className={`w-full h-14 text-white shadow-2xl text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 transform active:scale-[0.95] ${isRetail ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-pink-500/30' : 'bg-gradient-to-r from-blue-600 to-sky-700 hover:shadow-blue-600/30'}`}
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Verifying...
                                            </div>
                                        ) : (
                                            isRetail ? "Enter Retail Terminal" : "Authorize Warehouse Access"
                                        )}
                                    </Button>

                                    {isLocked && (
                                        <button
                                            type="button"
                                            onClick={() => window.location.href = '/'}
                                            className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all group pt-2"
                                        >
                                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                            System Select
                                        </button>
                                    )}
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="shrink-0 text-center pb-8 mt-auto relative z-10">
                <p className={`text-[10px] font-black uppercase tracking-[0.4em] transition-colors duration-500 ${isRetail ? 'text-pink-600/40' : 'text-blue-600/40'}`}>
                    Managed By Coko Intelligence Systems
                </p>
            </div>
        </div>

    );
}
