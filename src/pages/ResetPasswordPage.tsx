import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { IceCream, Lock, Loader2, CheckCircle } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

export function ResetPasswordPage() {
    usePageTitle('Reset Password');
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Supabase automatically handles the token from the URL hash on this page
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                // User arrived via the password reset link — ready to set new password
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleResetPassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast.error("Weak Password", { description: "Password must be at least 6 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Mismatch", { description: "Passwords do not match." });
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                toast.error("Reset Failed", { description: error.message });
            } else {
                setIsSuccess(true);
                toast.success("Password Updated!", { description: "You can now log in with your new password." });
                setTimeout(() => navigate('/login'), 3000);
            }
        } catch {
            toast.error("Error", { description: "Could not update password." });
        } finally {
            setIsLoading(false);
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
                                <CardTitle className="text-2xl">Set New Password</CardTitle>
                                <CardDescription className="text-sm">
                                    Enter your new password below.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isSuccess ? (
                                <div className="flex flex-col items-center gap-3 py-4">
                                    <CheckCircle className="w-12 h-12 text-emerald-500" />
                                    <p className="text-sm font-medium text-slate-700">Password updated successfully!</p>
                                    <p className="text-xs text-slate-500">Redirecting to login...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-password" className="text-xs">New Password</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="new-password"
                                                type="password"
                                                placeholder="Min 6 characters"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="pl-9 h-10 bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-password" className="text-xs">Confirm Password</Label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                id="confirm-password"
                                                type="password"
                                                placeholder="Re-enter password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="pl-9 h-10 bg-white"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleResetPassword}
                                        disabled={isLoading}
                                        className="w-full h-10 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg text-sm"
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Updating...
                                            </div>
                                        ) : (
                                            "Update Password"
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
