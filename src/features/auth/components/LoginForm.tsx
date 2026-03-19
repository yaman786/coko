import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
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
        <div className={`h-[100dvh] w-full flex flex-col transition-colors duration-500 ${isRetail ? 'bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100' : 'bg-gradient-to-br from-slate-100 via-blue-100 to-sky-100'} overflow-hidden`}>
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-md shrink-0">
                    <Card className="shadow-2xl border-0">
                        <CardHeader className="space-y-4 pb-6">
                            {/* Portal Toggle - Hidden if Locked */}
                            {!isLocked && (
                                <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                                    <button 
                                        onClick={() => setTargetApp('retail')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${isRetail ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        <IceCream className="w-3.5 h-3.5" />
                                        Coko Boutique
                                    </button>
                                    <button 
                                        onClick={() => setTargetApp('wholesale')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${!isRetail ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        <Warehouse className="w-3.5 h-3.5" />
                                        GOD Warehouse
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-center">
                                <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 transform ${isRetail ? 'bg-gradient-to-br from-pink-400 to-purple-500 rotate-0' : 'bg-gradient-to-br from-blue-500 to-sky-600 rotate-180'}`}>
                                    <div className="transform transition-transform duration-500" style={{ transform: isRetail ? 'rotate(0deg)' : 'rotate(-180deg)' }}>
                                        {isRetail ? (
                                            <IceCream className="w-10 h-10 text-white" />
                                        ) : (
                                            <Truck className="w-10 h-10 text-white" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <CardTitle className="text-3xl font-black tracking-tight transition-colors duration-500">
                                    {isRetail ? (
                                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600">coko</span>
                                    ) : (
                                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-sky-700">GOD</span>
                                    )}
                                </CardTitle>
                                <CardDescription className="text-xs font-medium uppercase tracking-widest text-gray-400">
                                    {isRetail ? 'Ice Cream Parlour & POS' : 'Wholesale Distribution Hub'}
                                </CardDescription>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {showForgotPassword ? (
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setShowForgotPassword(false)}
                                        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isRetail ? 'text-pink-600 hover:text-pink-800' : 'text-blue-600 hover:text-blue-800'}`}
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to Login
                                    </button>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-semibold text-slate-800">Reset Password</h3>
                                        <p className="text-sm text-slate-500">Enter your {isRetail ? 'admin' : 'manager'} email to receive a password reset link.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reset-email" className="text-xs">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="reset-email"
                                                type="email"
                                                placeholder="admin@coko.com"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                className="pl-9 h-11 bg-gray-50/50 border-gray-100 focus:bg-white transition-all"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleForgotPassword}
                                        disabled={isResetting}
                                        className={`w-full h-11 text-white shadow-lg text-sm transition-all duration-500 ${isRetail ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600' : 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700'}`}
                                    >
                                        {isResetting ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Sending...
                                            </div>
                                        ) : (
                                            "Send Reset Link"
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</Label>
                                        <div className="relative group">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder={isRetail ? "admin@coko.com" : "manager@god.com"}
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="pl-10 h-11 bg-gray-50/50 border-gray-100 focus:bg-white transition-all rounded-xl shadow-inner focus:ring-2 focus:ring-blue-500/20"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</Label>
                                        <div className="relative group">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="pl-10 h-11 bg-gray-50/50 border-gray-100 focus:bg-white transition-all rounded-xl shadow-inner focus:ring-2 focus:ring-blue-500/20"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className={`w-full h-12 text-white shadow-xl text-sm font-bold rounded-xl transition-all duration-500 transform active:scale-[0.98] ${isRetail ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-pink-500/20' : 'bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 shadow-blue-600/20'}`}
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                Authenticating...
                                            </div>
                                        ) : (
                                            isRetail ? "Enter Coko Boutique" : "Enter GOD Warehouse"
                                        )}
                                    </Button>

                                    <div className="text-center pt-2 flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPassword(true)}
                                            className={`text-xs font-bold transition-colors ${isRetail ? 'text-pink-500 hover:text-pink-700' : 'text-blue-500 hover:text-blue-700'}`}
                                        >
                                            Inaccessible Account? Reset Password
                                        </button>

                                        {isLocked && (
                                            <button
                                                type="button"
                                                onClick={() => window.location.href = '/'}
                                                className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all group"
                                            >
                                                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                                                Back to Selection
                                            </button>
                                        )}
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="shrink-0 text-center pb-6 mt-auto">
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] transition-colors duration-500 ${isRetail ? 'text-pink-600/60' : 'text-blue-600/60'}`}>
                    {isRetail ? 'Premium Retail Terminal' : 'Global Distribution Network'}
                </p>
            </div>
        </div>
    );
}
