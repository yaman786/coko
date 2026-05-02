import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Shift } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { 
    Wallet, 
    PlayCircle, 
    StopCircle, 
    Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { toast } from 'sonner';

export function PosRegisterControl() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [startingCash, setStartingCash] = useState('');
    const [startingCard, setStartingCard] = useState(''); // Added
    const [actualCash, setActualCash] = useState('');
    const [actualCard, setActualCard] = useState('');

    // Fetch Active Shift
    const { data: activeShift, isLoading: shiftLoading } = useQuery<Shift | null>({
        queryKey: ['active-shift-pos'],
        queryFn: () => api.getActiveShift('retail')
    });

    // Fetch Real-time Stats for the active shift
    const { data: shiftStats } = useQuery({
        queryKey: ['shift-stats', activeShift?.id],
        queryFn: () => api.getShiftStats(activeShift!.id, 'retail'),
        enabled: !!activeShift,
        refetchInterval: 30000 // Refresh every 30s
    });

    // Mutations
    const openRegisterMutation = useMutation({
        mutationFn: (payload: { cash: number, card: number }) => api.openShift({
            startingCash: payload.cash,
            startingCard: payload.card,
            cashierId: user?.email || 'unknown',
            cashierName: user?.email?.split('@')[0] || 'Unknown',
            portal: 'retail',
            user_id: user?.id
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-shift-pos'] });
            setIsModalOpen(false);
            setStartingCash('');
            setStartingCard('');
            toast.success('Register Opened Successfully');
        }
    });

    const closeRegisterMutation = useMutation({
        mutationFn: (payload: { actualCash: number, actualCard: number }) => {
            if (!shiftStats) throw new Error('Shift statistics not loaded. Please wait a moment.');
            return api.closeShift({
                shiftId: activeShift!.id,
                actualCash: payload.actualCash,
                actualCard: payload.actualCard,
                expectedCash: shiftStats.expectedCash,
                expectedCard: shiftStats.expectedCard
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-shift-pos'] });
            setIsModalOpen(false);
            setActualCash('');
            setActualCard('');
            toast.success('Register Closed Successfully');
        },
        onError: (err: any) => {
            toast.error('Failed to close register', { description: err.message });
        }
    });

    if (shiftLoading) return <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;

    const isOpen = !!activeShift;

    return (
        <>
            <div 
                className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all cursor-pointer ${
                    isOpen 
                    ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' 
                    : 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                }`}
                onClick={() => setIsModalOpen(true)}
            >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isOpen ? 'bg-emerald-500 shadow-emerald-200/50' : 'bg-rose-500 shadow-rose-200/50'
                } shadow-lg`}>
                    <Wallet className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isOpen ? 'Register Open' : 'Register Closed'}
                    </p>
                    <p className="text-xs font-bold text-slate-700">
                        {isOpen ? `Rs. ${shiftStats?.expectedCash?.toLocaleString() || activeShift.startingCash.toLocaleString()}` : 'Start Shift'}
                    </p>
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-slate-200 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-xl font-black font-['DM_Sans',sans-serif]">
                            {isOpen ? (
                                <>
                                    <StopCircle className="w-6 h-6 text-rose-500" />
                                    Close Register
                                </>
                            ) : (
                                <>
                                    <PlayCircle className="w-6 h-6 text-emerald-500" />
                                    Open Register
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">
                            {isOpen 
                                ? 'Finalize today\'s sales and count the physical cash in the drawer.'
                                : 'Initialize the cash drawer with a starting float amount.'}
                        </DialogDescription>
                    </DialogHeader>

                    {!isOpen ? (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opening Cash (Nrs.)</label>
                                    <Input 
                                        type="number"
                                        value={startingCash}
                                        onChange={(e) => setStartingCash(e.target.value)}
                                        placeholder="e.g. 5000"
                                        className="h-12 text-xl font-black text-center bg-slate-50 border-slate-200 rounded-xl focus:ring-emerald-500"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opening Card (Nrs.)</label>
                                    <Input 
                                        type="number"
                                        value={startingCard}
                                        onChange={(e) => setStartingCard(e.target.value)}
                                        placeholder="Bank/Wallet"
                                        className="h-12 text-xl font-black text-center bg-slate-50 border-slate-200 rounded-xl focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                            <Button 
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/20 uppercase tracking-widest text-xs"
                                onClick={() => openRegisterMutation.mutate({ 
                                    cash: parseFloat(startingCash) || 0, 
                                    card: parseFloat(startingCard) || 0 
                                })}
                                disabled={startingCash === '' || startingCard === '' || openRegisterMutation.isPending}
                            >
                                {openRegisterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                                Initialize Register
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 py-4">
                            {/* Stats Summary */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Cash In</p>
                                    <p className="text-lg font-black text-emerald-600">Rs. {shiftStats?.cashIn?.toLocaleString() || 0}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Digital</p>
                                    <p className="text-lg font-black text-blue-600">Rs. {shiftStats?.cardIn?.toLocaleString() || 0}</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 col-span-2 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Expected Drawer</p>
                                        <p className="text-xl font-black text-slate-800">Rs. {shiftStats?.expectedCash?.toLocaleString() || 0}</p>
                                    </div>
                                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-none px-3 py-1 font-black">
                                        Live Status
                                    </Badge>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Physical Cash Count</label>
                                        {actualCash && shiftStats && (
                                            <Badge variant={parseFloat(actualCash) - shiftStats.expectedCash === 0 ? 'secondary' : 'destructive'} className="text-[9px] font-black">
                                                {parseFloat(actualCash) - shiftStats.expectedCash > 0 ? '+' : ''}
                                                {(parseFloat(actualCash) - shiftStats.expectedCash).toLocaleString()} Variance
                                            </Badge>
                                        )}
                                    </div>
                                    <Input 
                                        type="number"
                                        value={actualCash}
                                        onChange={(e) => setActualCash(e.target.value)}
                                        placeholder="Physical cash total"
                                        className="h-12 text-xl font-black text-center bg-slate-50 border-slate-200 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Actual Card Total</label>
                                    <Input 
                                        type="number"
                                        value={actualCard}
                                        onChange={(e) => setActualCard(e.target.value)}
                                        placeholder="Bank/POS total"
                                        className="h-12 text-xl font-black text-center bg-slate-50 border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>

                            <Button 
                                className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-lg shadow-rose-500/20 uppercase tracking-widest text-xs"
                                onClick={() => closeRegisterMutation.mutate({ 
                                    actualCash: parseFloat(actualCash) || 0, 
                                    actualCard: parseFloat(actualCard) || 0 
                                })}
                                disabled={actualCash === '' || actualCard === '' || closeRegisterMutation.isPending}
                            >
                                {closeRegisterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <StopCircle className="w-4 h-4 mr-2" />}
                                Close Register & Reconcile
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
