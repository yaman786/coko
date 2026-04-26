// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../../../components/ui/alert-dialog";
import { Plus, Mail, Trash2, Archive, RefreshCcw, Loader2, Edit2 } from 'lucide-react';
import { api } from '../../../services/api';
import { supabase } from '../../../lib/supabase';
import type { Staff } from '../../../types';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';

export function WholesaleStaffSection() {
    const { user, role: currentUserRole } = useAuth();
    const queryClient = useQueryClient();
    const currentPortal = 'wholesale';
    const [showArchived, setShowArchived] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'cashier' as 'admin' | 'cashier',
    });

    const resetForm = () => {
        setFormData({ name: '', email: '', password: '', role: 'cashier' });
        setEditingStaff(null);
    };

    // 1. Data Fetching - Specific for Wholesale
    const { data: staff = [], isLoading } = useQuery({
        queryKey: ['staff', currentPortal, showArchived],
        queryFn: () => api.getStaff(showArchived, currentPortal),
    });

    // 2. Mutations
    const upsertMutation = useMutation({
        mutationFn: (data: Staff) => api.upsertStaff({ ...data, portal: currentPortal }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff', currentPortal] });
            setIsAddDialogOpen(false);
            resetForm();
        },
        onError: () => toast.error('Failed to save GOD staff profile')
    });

    const updateStaffMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<Staff> }) => api.updateStaff(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff', currentPortal] });
            setIsAddDialogOpen(false);
            resetForm();
        },
        onError: () => toast.error('Failed to update team member')
    });

    const handleSaveStaff = async () => {
        if (!formData.name.trim() || !formData.email.trim()) {
            toast.error("Validation Error", { description: "Name and Email are required." });
            return;
        }

        if (editingStaff) {
            updateStaffMutation.mutate({
                id: editingStaff.id,
                data: {
                    name: formData.name,
                    role: formData.role
                }
            });
            toast.success("Team Updated", { description: `${formData.name}'s profile has been updated.` });
        } else {
            if (!formData.password || formData.password.length < 6) {
                toast.error("Weak Password", { description: "Password must be at least 6 characters." });
                return;
            }

            try {
                const { error: signUpError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            name: formData.name,
                            role: formData.role,
                            portal: currentPortal
                        }
                    }
                });

                if (signUpError) {
                    toast.error("Auth Error", { description: signUpError.message });
                    return;
                }

                upsertMutation.mutate({
                    id: crypto.randomUUID(),
                    name: formData.name,
                    email: formData.email,
                    role: formData.role,
                    updatedAt: new Date(),
                    isDeleted: false,
                    user_id: user?.id,
                    portal: currentPortal
                });

                toast.success("Team Member Added", { description: `${formData.name} joined the GOD Hub!` });
            } catch (error) {
                toast.error("Error", { description: "Failed to create team profile." });
            }
        }
    };

    const handleEditClick = (member: Staff) => {
        setEditingStaff(member);
        setFormData({
            name: member.name,
            email: member.email,
            password: '', 
            role: member.role
        });
        setIsAddDialogOpen(true);
    };

    const handleDeleteStaff = async (id: string) => {
        updateStaffMutation.mutate({ id, data: { isDeleted: true } });
        toast.success("Access Revoked", { description: "User removed from active wholesale team." });
    };

    if (isLoading && staff.length === 0) {
        return (
            <div className="flex flex-col h-64 items-center justify-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                <p className="text-slate-500 font-medium tracking-tight">Syncing GOD directory...</p>
            </div>
        );
    }

    const filteredStaff = staff.filter((member: Staff) =>
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    return (
        <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-xl shadow-lg border border-slate-200/60 overflow-hidden rounded-2xl">
                <CardHeader className="bg-white/50 border-b border-slate-100 pb-6 pt-8 px-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl font-bold text-slate-800 font-['DM_Sans',sans-serif]">GOD Team Management</CardTitle>
                            <CardDescription>Configure access levels for the wholesale distribution network.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {currentUserRole === 'admin' && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowArchived(!showArchived)}
                                    className={`gap-2 h-10 ${showArchived ? 'bg-sky-50 border-sky-200 text-sky-700' : 'text-slate-500'}`}
                                >
                                    <Archive className="w-4 h-4" />
                                    {showArchived ? 'Active Team' : 'View Archived'}
                                </Button>
                            )}
                            <Dialog open={isAddDialogOpen} onOpenChange={(open: boolean) => {
                                setIsAddDialogOpen(open);
                                if (!open) resetForm();
                            }}>
                                <DialogTrigger asChild>
                                    <Button onClick={() => resetForm()} className="bg-sky-600 hover:bg-sky-700 text-white gap-2 h-10 shadow-sm border-0">
                                        <Plus className="w-4 h-4" />
                                        Add Member
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{editingStaff ? "Update Team Member" : "Join GOD Team"}</DialogTitle>
                                        <DialogDescription>
                                            {editingStaff ? "Update wholesale access level." : "Register a new wholesale operator."}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <Input value={formData.name} onChange={(e: any) => setFormData({ ...formData, name: e.target.value })} placeholder="GOD Operator" className="focus-visible:ring-sky-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Login Email</Label>
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                disabled={!!editingStaff}
                                                onChange={(e: any) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="user@godhub.com"
                                                className={editingStaff ? "bg-slate-50 text-slate-500" : "focus-visible:ring-sky-500"}
                                            />
                                        </div>
                                        {!editingStaff && (
                                            <div className="space-y-2">
                                                <Label>Password</Label>
                                                <Input type="password" value={formData.password} onChange={(e: any) => setFormData({ ...formData, password: e.target.value })} placeholder="Min 6 characters" className="focus-visible:ring-sky-500" />
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>Access Level</Label>
                                            <Select value={formData.role} onValueChange={(value: 'admin' | 'cashier') => setFormData({ ...formData, role: value })}>
                                                <SelectTrigger className="focus:ring-sky-500"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cashier">Operator (Restricted)</SelectItem>
                                                    <SelectItem value="admin">Admin (Full Control)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handleSaveStaff} disabled={upsertMutation.isPending || updateStaffMutation.isPending} className="w-full bg-sky-600 shadow-md h-11 mt-4">
                                            {(upsertMutation.isPending || updateStaffMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            {editingStaff ? "Sync Changes" : "Confirm Onboarding"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <Input placeholder="Search team directory..." value={searchQuery} onChange={(e: any) => setSearchQuery(e.target.value)} className="mb-6 max-w-sm h-11 focus-visible:ring-sky-500" />
                    <div className="rounded-xl border border-slate-200 overflow-x-auto overflow-hidden shadow-sm">
                        <Table className="min-w-[600px]">
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Identity</TableHead>
                                    <TableHead>Credentials</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead className="text-right">Control</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStaff.map((member: Staff) => (
                                    <TableRow key={member.id} className={`group hover:bg-slate-50/50 ${member.isDeleted ? 'opacity-60 bg-slate-50' : ''}`}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                    {getInitials(member.name)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 tracking-tight">{member.name}</p>
                                                    {member.isDeleted && <Badge variant="outline" className="text-[10px] h-4 border-slate-200 bg-white">Deactivated</Badge>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                <Mail className="w-3.5 h-3.5 opacity-40" />
                                                {member.email}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className={member.role === 'admin' ? 'bg-sky-600 shadow-sm border-0 text-white' : 'bg-slate-100 text-slate-600 border-slate-200 shadow-none'}>
                                                {member.role === 'admin' ? 'Admin' : 'Operator'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {member.isDeleted ? (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => api.updateStaff(member.id, { isDeleted: false })}>
                                                        <RefreshCcw className="w-4 h-4" />
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-sky-600 hover:bg-sky-50" onClick={() => handleEditClick(member)}>
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>

                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Revoke Wholesale Access?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will immediately block <strong>{member.name}</strong> from the GOD Hub. 
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteStaff(member.id)} className="bg-red-500 hover:bg-red-600 text-white font-bold">
                                                                        Confirm Revocation
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredStaff.length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-400 font-medium bg-slate-50/30">Directory empty</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
