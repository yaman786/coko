import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { IceCream, Lock, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

interface LoginFormProps {
    onLogin: (email: string, password: string) => void;
    isLoading?: boolean;
}

export function LoginForm({ onLogin, isLoading = false }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [isResetting, setIsResetting] = useState(false);

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
        <div className="h-[100dvh] w-full flex flex-col bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
                <div className="w-full max-w-md shrink-0">
                    <Card className="shadow-2xl border-0">
                        <CardHeader className="space-y-2 pb-4">
                            <div className="flex justify-center">
                                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-lg">
                                    <IceCream className="w-8 h-8 text-white" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <CardTitle className="text-2xl">coko</CardTitle>
                                <CardDescription className="text-sm">
                                    Ice Cream Parlour Management System
                                </CardDescription>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {showForgotPassword ? (
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setShowForgotPassword(false)}
                                        className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Back to Login
                                    </button>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-semibold text-slate-800">Reset Password</h3>
                                        <p className="text-sm text-slate-500">Enter your admin email to receive a password reset link.</p>
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
                                                className="pl-9 h-10 bg-white"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleForgotPassword}
                                        disabled={isResetting}
                                        className="w-full h-10 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg text-sm"
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
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-xs">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="your.email@coko.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="pl-9 h-10 bg-white"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-xs">Password</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="password"
                                                type="password"
                                                placeholder="Enter your password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="pl-9 h-10 bg-white"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full h-10 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                Authenticating...
                                            </div>
                                        ) : (
                                            "Sign In to Dashboard"
                                        )}
                                    </Button>

                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotPassword(true)}
                                            className="text-xs text-purple-500 hover:text-purple-700 font-medium transition-colors"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="shrink-0 text-center pb-4 mt-auto">
                <p className="text-[11px] sm:text-xs text-gray-600/90 font-medium tracking-wide">
                    Access: POS • Inventory • Staff Management
                </p>
            </div>
        </div>
    );
}
