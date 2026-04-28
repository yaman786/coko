import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import type { WsClient } from '../../../types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

interface Props {
    client: WsClient;
    open: boolean;
    onClose: () => void;
}

export function SetOpeningBalanceDialog({ client, open, onClose }: Props) {
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'Dr' | 'Cr'>('Dr');

    const mutation = useMutation({
        mutationFn: async () => {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) throw new Error('Please enter a valid amount.');

            // Debit (Dr) = Client owes us = ORDER_CREDIT
            // Credit (Cr) = Advance/We owe client = PAYMENT_RECEIVED
            const txType = type === 'Dr' ? 'ORDER_CREDIT' : 'PAYMENT_RECEIVED';

            await wholesaleApi.recordOpeningBalance(
                client.id,
                numAmount,
                txType
            );
        },
        onSuccess: () => {
            toast.success("Opening balance recorded successfully");
            queryClient.invalidateQueries({ queryKey: ['ws_client_transactions', client.id] });
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] });
            onClose();
            setAmount('');
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to record opening balance");
        }
    });

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Set Opening Balance</DialogTitle>
                    <DialogDescription>
                        Record the migrated opening balance for {client.name}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Balance Type</Label>
                        <Select value={type} onValueChange={(val: 'Dr' | 'Cr') => setType(val)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Dr">Debit (Client Owes Us)</SelectItem>
                                <SelectItem value="Cr">Credit (Advance / We Owe Client)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 5000"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
                        Cancel
                    </Button>
                    <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !amount}>
                        {mutation.isPending ? 'Saving...' : 'Save Opening Balance'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
