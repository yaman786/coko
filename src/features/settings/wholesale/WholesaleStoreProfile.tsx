// @ts-nocheck
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import { toast } from 'sonner';

export function WholesaleStoreProfile() {
    const queryClient = useQueryClient();
    const currentPortal = 'wholesale';
    const [formData, setFormData] = useState({
        storeName: '',
        address: '',
        phone: '',
        taxRate: '',
    });

    // 1. Data Fetching - Specifically for Wholesale
    const { data: settings, isLoading } = useQuery({
        queryKey: ['storeSettings', currentPortal],
        queryFn: () => api.getStoreSettings(currentPortal),
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
        mutationFn: (data: any) => api.updateStoreSettings({ ...data, portal: currentPortal }),
        onSuccess: () => {
            toast.success("GOD Settings Updated", { description: "Wholesale profile saved successfully." });
            queryClient.invalidateQueries({ queryKey: ['storeSettings', currentPortal] });
        },
        onError: () => toast.error("Update Failed", { description: "Could not save wholesale profile." })
    });

    const handleSave = async () => {
        if (!formData.storeName.trim()) {
            toast.error("Validation Error", { description: "Hub name cannot be empty." });
            return;
        }

        const taxRate = Number(formData.taxRate);
        if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
            toast.error("Validation Error", { description: "Tax rate must be between 0 and 100." });
            return;
        }

        updateMutation.mutate({
            id: settings?.id || 1, // Use existing ID if available
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
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                <p className="text-slate-500 font-medium tracking-tight">Loading GOD profile...</p>
            </div>
        );
    }

    return (
        <Card className="max-w-2xl bg-white/80 backdrop-blur-xl shadow-lg border border-slate-200/60 overflow-hidden rounded-2xl">
            <CardHeader className="bg-white/50 border-b border-slate-100 pb-6 pt-8 px-8">
                <CardTitle className="text-xl font-bold text-slate-800 font-['DM_Sans',sans-serif]">Wholesale HUB Profile</CardTitle>
                <CardDescription>Configure the identity and tax rules for the GOD wholesale network.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                    <Label htmlFor="storeName">Hub Name</Label>
                    <Input
                        id="storeName"
                        value={formData.storeName}
                        onChange={(e: any) => setFormData({ ...formData, storeName: e.target.value })}
                        placeholder="e.g. GOD Wholesale Central"
                        className="h-11 shadow-sm focus-visible:ring-sky-500"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">Warehouse Address</Label>
                    <Input
                        id="address"
                        value={formData.address}
                        onChange={(e: any) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="GOD Distribution Center, Main St"
                        className="h-11 shadow-sm focus-visible:ring-sky-500"
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Contact Number</Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e: any) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+977 123456789"
                            className="h-11 shadow-sm focus-visible:ring-sky-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="taxRate">Wholesale VAT (%)</Label>
                        <Input
                            id="taxRate"
                            type="number"
                            min="0"
                            step="0.1"
                            value={formData.taxRate}
                            onChange={(e: any) => setFormData({ ...formData, taxRate: e.target.value })}
                            placeholder="13"
                            className="h-11 shadow-sm focus-visible:ring-sky-500"
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 bg-slate-50/50 rounded-b-xl px-6 py-4 flex justify-end gap-3">
                <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="bg-sky-600 hover:bg-sky-700 text-white gap-2 h-11 px-6 shadow-md border-0"
                >
                    {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {updateMutation.isPending ? 'Syncing...' : 'Update GOD Profile'}
                </Button>
            </CardFooter>
        </Card>
    );
}
