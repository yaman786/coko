import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';

export function ChangePassword() {
    const { user } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleChangePassword = async () => {
        if (!currentPassword) {
            toast.error("Required", { description: "Please enter your current password." });
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            toast.error("Weak Password", { description: "New password must be at least 6 characters." });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Mismatch", { description: "New passwords do not match." });
            return;
        }

        setIsLoading(true);
        try {
            // Verify current password by re-authenticating
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user?.email || '',
                password: currentPassword,
            });

            if (signInError) {
                toast.error("Incorrect Password", { description: "Your current password is wrong." });
                setIsLoading(false);
                return;
            }

            // Update to new password
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                toast.error("Update Failed", { description: error.message });
            } else {
                setIsSuccess(true);
                toast.success("Password Changed!", { description: "Your password has been updated successfully." });
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => setIsSuccess(false), 3000);
            }
        } catch {
            toast.error("Error", { description: "Could not change password." });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="border-0 shadow-md ring-1 ring-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                <CardTitle className="text-xl text-slate-800">Change Password</CardTitle>
                <CardDescription>Update your login password. You'll need to enter your current password first.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="max-w-md space-y-4">
                    {isSuccess && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-700">Password changed successfully!</p>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="current-password" className="text-sm">Current Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                id="current-password"
                                type="password"
                                placeholder="Enter current password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="pl-9 h-11"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-password" className="text-sm">New Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                id="new-password"
                                type="password"
                                placeholder="Min 6 characters"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pl-9 h-11"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-new-password" className="text-sm">Confirm New Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                id="confirm-new-password"
                                type="password"
                                placeholder="Re-enter new password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="pl-9 h-11"
                            />
                        </div>
                    </div>
                    <Button
                        onClick={handleChangePassword}
                        disabled={isLoading}
                        className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white shadow-md mt-2"
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
            </CardContent>
        </Card>
    );
}
