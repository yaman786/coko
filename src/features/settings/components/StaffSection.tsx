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

export function StaffSection() {
    const { user, role: currentUserRole } = useAuth();
    const queryClient = useQueryClient();
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

    // 1. Data Fetching
    const { data: staff = [], isLoading } = useQuery({
        queryKey: ['staff', showArchived],
        queryFn: () => api.getStaff(showArchived),
    });

    // 2. Mutations
    const upsertMutation = useMutation({
        mutationFn: api.upsertStaff,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setIsAddDialogOpen(false);
            resetForm();
        },
        onError: () => toast.error('Failed to save staff profile')
    });

    const updateStaffMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<Staff> }) => api.updateStaff(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff'] });
            setIsAddDialogOpen(false);
            resetForm();
        },
        onError: () => toast.error('Failed to update staff member')
    });

    const handleSaveStaff = async () => {
        if (!formData.name.trim() || !formData.email.trim()) {
            toast.error("Validation Error", { description: "Name and Email are required." });
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error("Invalid Email", { description: "Please enter a valid email address." });
            return;
        }

        if (editingStaff) {
            // UPDATE FLOW
            updateStaffMutation.mutate({
                id: editingStaff.id,
                data: {
                    name: formData.name,
                    role: formData.role
                    // Note: Email changes and password resets strictly require 
                    // Supabase Auth Admin API limits, so we only update metadata.
                }
            });
            toast.success("Staff Updated", { description: `${formData.name}'s profile has been updated.` });
        } else {
            // CREATE FLOW
            if (!formData.password || formData.password.length < 6) {
                toast.error("Weak Password", { description: "Password must be at least 6 characters." });
                return;
            }

            try {
                // 1. Create the user in Supabase Auth (email confirmation is disabled in dashboard)
                const { error: signUpError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            name: formData.name,
                            role: formData.role
                        }
                    }
                });

                if (signUpError) {
                    console.error("Supabase Auth Error:", signUpError);
                    toast.error("Auth Error", { description: signUpError.message });
                    return;
                }

                // 2. Create the RBAC profile in Supabase via API
                upsertMutation.mutate({
                    id: crypto.randomUUID(),
                    name: formData.name,
                    email: formData.email,
                    role: formData.role,
                    updatedAt: new Date(),
                    isDeleted: false,
                    user_id: user?.id
                });

                toast.success("Staff Created", { description: `${formData.name} can now log in immediately!` });
            } catch (error) {
                console.error(error);
                toast.error("Error", { description: "Failed to create staff profile." });
            }
        }
    };



    const handleEditClick = (member: Staff) => {
        setEditingStaff(member);
        setFormData({
            name: member.name,
            email: member.email,
            password: '', // Hidden in edit mode
            role: member.role
        });
        setIsAddDialogOpen(true);
    };

    const handleDeleteStaff = async (id: string) => {
        updateStaffMutation.mutate({ id, data: { isDeleted: true } });
        toast.success("Staff Removed", { description: "Their access has been immediately revoked." });
    };

    const handleRestoreStaff = async (id: string) => {
        updateStaffMutation.mutate({ id, data: { isDeleted: false } });
        toast.success("Staff profile restored");
    };

    if (isLoading && staff.length === 0) {
        return (
            <div className="flex flex-col h-64 items-center justify-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-slate-500 font-medium tracking-tight">Syncing staff directory...</p>
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
            <Card className="border-0 shadow-md ring-1 ring-slate-200">
                <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-xl text-slate-800">Staff Management</CardTitle>
                            <CardDescription>Configure Role-Based Access Control (RBAC) across the POS.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {currentUserRole === 'admin' && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowArchived(!showArchived)}
                                    className={`gap-2 h-10 ${showArchived ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'text-slate-500'}`}
                                >
                                    <Archive className="w-4 h-4" />
                                    {showArchived ? 'Active Staff' : 'View Archived'}
                                </Button>
                            )}
                            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                                setIsAddDialogOpen(open);
                                if (!open) resetForm();
                            }}>
                                <DialogTrigger asChild>
                                    <Button onClick={() => resetForm()} className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-10 shadow-sm border-0">
                                        <Plus className="w-4 h-4" />
                                        Add Staff
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
                                        <DialogDescription>
                                            {editingStaff ? "Update role and display name." : "Register a new employee for secure POS login."}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Full Name</Label>
                                            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Jane Doe" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Login Email</Label>
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                disabled={!!editingStaff} // Email usually acts as the immutable PK in auth flows
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="jane@coko.com"
                                                className={editingStaff ? "bg-slate-50 text-slate-500" : ""}
                                            />
                                        </div>
                                        {!editingStaff && (
                                            <div className="space-y-2">
                                                <Label>Password</Label>
                                                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Min 6 characters" />
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>System Role</Label>
                                            <Select value={formData.role} onValueChange={(value: 'admin' | 'cashier') => setFormData({ ...formData, role: value })}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="cashier">Cashier (POS Only)</SelectItem>
                                                    <SelectItem value="admin">System Admin (Full Access)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handleSaveStaff} disabled={upsertMutation.isPending || updateStaffMutation.isPending} className="w-full bg-purple-600 shadow-md h-11 mt-4">
                                            {(upsertMutation.isPending || updateStaffMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            {editingStaff ? "Save Changes" : "Create Profile"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <Input placeholder="Search staff..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mb-6 max-w-sm h-11" />
                    <div className="rounded-xl border border-slate-200 overflow-x-auto overflow-hidden shadow-sm">
                        <Table className="min-w-[600px]">
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Staff Member</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStaff.map((member: Staff) => (
                                    <TableRow key={member.id} className={`group hover:bg-slate-50/50 ${member.isDeleted ? 'opacity-60 bg-slate-50' : ''}`}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                                    {getInitials(member.name)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 tracking-tight">{member.name}</p>
                                                    {member.isDeleted && <Badge variant="outline" className="text-[10px] h-4 border-slate-200 bg-white">Archived</Badge>}
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
                                            <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className={member.role === 'admin' ? 'bg-indigo-600 shadow-sm border-0' : 'bg-slate-100 text-slate-600 border-slate-200 shadow-none'}>
                                                {member.role === 'admin' ? 'Admin' : 'Cashier'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {member.isDeleted ? (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => handleRestoreStaff(member.id)}>
                                                        <RefreshCcw className="w-4 h-4" />
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50" onClick={() => handleEditClick(member)}>
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
                                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will immediately revoke <strong>{member.name}</strong>'s access to the POS system. By archiving, their past transactions remain safe, but they can no longer log in.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteStaff(member.id)} className="bg-red-500 hover:bg-red-600 text-white">
                                                                        Yes, Archive User
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
                                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-400 font-medium bg-slate-50/30">No matching staff members</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
