import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import { toast } from 'sonner';

export function StoreProfile() {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        storeName: '',
        address: '',
        phone: '',
        taxRate: '',
    });

    // 1. Data Fetching
    const { data: settings, isLoading } = useQuery({
        queryKey: ['storeSettings'],
        queryFn: api.getStoreSettings,
    });

    // Update local state when query data changes
    useEffect(() => {
        if (settings) {
            setFormData({
                storeName: settings.storeName || '',
                address: settings.address || '',
                phone: settings.phone || '',
                taxRate: settings.taxRate?.toString() || '0',
            });
        }
    }, [settings]);

    // 2. Mutations
    const updateMutation = useMutation({
        mutationFn: api.updateStoreSettings,
        onSuccess: () => {
            toast.success("Settings Updated", { description: "Store profile saved successfully." });
            queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
        },
        onError: () => toast.error("Update Failed", { description: "Could not save store profile." })
    });

    const handleSave = async () => {
        if (!formData.storeName.trim()) {
            toast.error("Validation Error", { description: "Store name cannot be empty." });
            return;
        }

        const taxRate = Number(formData.taxRate);
        if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
            toast.error("Validation Error", { description: "Tax rate must be between 0 and 100." });
            return;
        }

        updateMutation.mutate({
            id: 1,
            storeName: formData.storeName,
            address: formData.address,
            phone: formData.phone,
            taxRate: taxRate,
            updatedAt: new Date()
        });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-64 items-center justify-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 lg:max-w-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-slate-500 font-medium tracking-tight">Loading store profile...</p>
            </div>
        );
    }

    return (
        <Card className="max-w-2xl border-0 shadow-md ring-1 ring-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100">
                <CardTitle className="text-xl text-slate-800">Store Profile</CardTitle>
                <CardDescription>Update your store's public information and global tax rates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input
                        id="storeName"
                        value={formData.storeName}
                        onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                        placeholder="e.g. Coko Ice Cream"
                        className="h-11 shadow-sm"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">Physical Address</Label>
                    <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="123 Example St, City"
                        className="h-11 shadow-sm"
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Contact Number</Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1 234 567 890"
                            className="h-11 shadow-sm"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="taxRate">VAT / Tax Rate (%)</Label>
                        <Input
                            id="taxRate"
                            type="number"
                            min="0"
                            step="0.1"
                            value={formData.taxRate}
                            onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                            placeholder="13"
                            className="h-11 shadow-sm"
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50/50 rounded-b-xl px-6 py-4 flex justify-end gap-3">
                <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-11 px-6 shadow-md border-0"
                >
                    {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
            </CardFooter>
        </Card>
    );
}
