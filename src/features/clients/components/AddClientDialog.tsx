import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { api } from '../../../services/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Supplier } from '../../../types';

export function AddClientDialog({ open, onOpenChange, onSuccess, editingSupplier, portal }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void, editingSupplier?: Supplier | null, portal: string }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: ''
    });

    useEffect(() => {
        if (editingSupplier) {
            setFormData({
                name: editingSupplier.name,
                contact_person: editingSupplier.contact_person || '',
                phone: editingSupplier.phone || '',
                email: editingSupplier.email || '',
                address: editingSupplier.address || ''
            });
        } else {
            setFormData({
                name: '',
                contact_person: '',
                phone: '',
                email: '',
                address: ''
            });
        }
    }, [editingSupplier, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.upsertSupplier({
                ...formData,
                id: editingSupplier?.id,
                portal: portal as any,
                current_balance: editingSupplier?.current_balance || 0
            });
            toast.success(editingSupplier ? 'Client updated successfully' : 'Client added successfully');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(editingSupplier ? 'Failed to update client' : 'Failed to add client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight">
                        {editingSupplier ? 'Refine Client' : 'New Client Intake'}
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Acme Corp"
                            className="rounded-xl border-slate-200 h-12"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="contact" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Point of Contact</Label>
                            <Input
                                id="contact"
                                value={formData.contact_person}
                                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                placeholder="Name"
                                className="rounded-xl border-slate-200 h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="0123456789"
                                className="rounded-xl border-slate-200 h-12"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="client@example.com"
                            className="rounded-xl border-slate-200 h-12"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Physical Address</Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Street, City, State"
                            className="rounded-xl border-slate-200 h-12"
                        />
                    </div>
                    <DialogFooter className="pt-4">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl border-slate-200"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading} 
                            className={`${portal === 'wholesale' ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-100' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-100'} rounded-xl font-bold min-w-[100px] text-white shadow-lg`}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingSupplier ? 'Save Changes' : 'Add Client'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
