import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { X } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import type { WsClient } from '../../../types';

interface Props {
    open: boolean;
    onClose: () => void;
    editingClient: WsClient | null;
}

export function AddWsClientDialog({ open, onClose, editingClient }: Props) {
    const queryClient = useQueryClient();
    const isEditing = !!editingClient;

    const [form, setForm] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        city: 'Kathmandu',
        notes: '',
    });

    useEffect(() => {
        if (editingClient) {
            setForm({
                name: editingClient.name,
                contact_person: editingClient.contact_person || '',
                phone: editingClient.phone || '',
                email: editingClient.email || '',
                address: editingClient.address || '',
                city: editingClient.city || 'Kathmandu',
                notes: editingClient.notes || '',
            });
        } else {
            setForm({ name: '', contact_person: '', phone: '', email: '', address: '', city: 'Kathmandu', notes: '' });
        }
    }, [editingClient, open]);

    const mutation = useMutation({
        mutationFn: (client: Partial<WsClient>) => wholesaleApi.upsertClient(client),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] });
            toast.success(isEditing ? 'Client updated' : 'Client added');
            onClose();
        },
        onError: () => toast.error('Failed to save client'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error('Client name is required');

        mutation.mutate({
            ...(editingClient && { id: editingClient.id }),
            name: form.name.trim(),
            contact_person: form.contact_person.trim() || undefined,
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
            address: form.address.trim() || undefined,
            city: form.city.trim() || 'Kathmandu',
            notes: form.notes.trim() || undefined,
            is_active: true,
            balance: editingClient?.balance ?? 0,
        });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isEditing ? 'Edit Client' : 'Add New Client'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Business Name *</label>
                        <Input
                            placeholder="e.g., Blue Moon Cafe"
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            className="h-11"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Person</label>
                            <Input
                                placeholder="Manager name"
                                value={form.contact_person}
                                onChange={(e) => setForm(f => ({ ...f, contact_person: e.target.value }))}
                                className="h-11"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
                            <Input
                                placeholder="98XXXXXXXX"
                                value={form.phone}
                                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                                className="h-11"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                        <Input
                            type="email"
                            placeholder="optional"
                            value={form.email}
                            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                            className="h-11"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address</label>
                            <Input
                                placeholder="Location/Area"
                                value={form.address}
                                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                                className="h-11"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">City</label>
                            <Input
                                placeholder="Kathmandu"
                                value={form.city}
                                onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                                className="h-11"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
                        <textarea
                            placeholder="Any additional notes about this client..."
                            value={form.notes}
                            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            rows={2}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {mutation.isPending ? 'Saving...' : isEditing ? 'Update Client' : 'Add Client'}
                    </button>
                </form>
            </div>
        </div>
    );
}
