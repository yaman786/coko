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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
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
    const [closingNotes, setClosingNotes] = useState(''); // Added for accountability

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
        mutationFn: (payload: { actualCash: number, actualCard: number, notes?: string }) => {
            if (!shiftStats) throw new Error('Shift statistics not loaded. Please wait a moment.');
            return api.closeShift({
                shiftId: activeShift!.id,
                actualCash: payload.actualCash,
                actualCard: payload.actualCard,
                expectedCash: shiftStats.expectedCash,
                expectedCard: shiftStats.expectedCard,
                notes: payload.notes
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-shift-pos'] });
            setIsModalOpen(false);
            setActualCash('');
            setActualCard('');
            setClosingNotes(''); // Reset
            toast.success('Register Closed Successfully');
        },
        onError: (err: any) => {
            toast.error('Failed to close register', { description: err.message });
        }
    });

    if (shiftLoading) return <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;

    const isOpen = !!activeShift;
    const cashVariance = (parseFloat(actualCash) || 0) - (shiftStats?.expectedCash || 0);
    const cardVariance = (parseFloat(actualCard) || 0) - (shiftStats?.expectedCard || 0);

    return (
        <>
            <div 
                className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all cursor-pointer shadow-sm active:scale-95 ${
                    isOpen 
                    ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:shadow-emerald-100/50' 
                    : 'bg-rose-50 border-rose-200 hover:bg-rose-100 hover:shadow-rose-100/50'
                }`}
                onClick={() => setIsModalOpen(true)}
            >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isOpen ? 'bg-emerald-500 shadow-emerald-200/50' : 'bg-rose-500 shadow-rose-200/50'
                } shadow-lg transition-transform group-hover:scale-110`}>
                    <Wallet className="w-4 h-4 text-white" />
                </div>
                <div className="hidden sm:block">
                    <p className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none mb-1 ${isOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isOpen ? 'Register Live' : 'Register Closed'}
                    </p>
                    <p className="text-sm font-black text-slate-800 leading-none">
                        {isOpen ? `Rs. ${shiftStats?.expectedCash?.toLocaleString() || activeShift.startingCash.toLocaleString()}` : 'Initialize'}
                    </p>
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-2xl border-0 shadow-2xl rounded-[2rem] p-0 overflow-hidden">
                    <div className={`h-32 p-8 flex flex-col justify-end ${isOpen ? 'bg-gradient-to-br from-indigo-600 to-violet-700' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                        <DialogTitle className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                            {isOpen ? <StopCircle className="w-8 h-8" /> : <PlayCircle className="w-8 h-8" />}
                            {isOpen ? 'Reconciliation' : 'Open Shift'}
                        </DialogTitle>
                        <DialogDescription className="text-white/70 font-bold uppercase text-[10px] tracking-[0.2em]">
                            {isOpen ? 'Shift Settlement Protocol' : 'Initial Float Configuration'}
                        </DialogDescription>
                    </div>

                    <div className="p-8 space-y-6">
                        {!isOpen ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Cash</label>
                                        <Input 
                                            type="number"
                                            value={startingCash}
                                            onChange={(e) => setStartingCash(e.target.value)}
                                            placeholder="5000"
                                            className="h-14 text-2xl font-black text-center bg-slate-50 border-0 focus:ring-2 focus:ring-emerald-500 rounded-2xl shadow-inner"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opening Card</label>
                                        <Input 
                                            type="number"
                                            value={startingCard}
                                            onChange={(e) => setStartingCard(e.target.value)}
                                            placeholder="0"
                                            className="h-14 text-2xl font-black text-center bg-slate-50 border-0 focus:ring-2 focus:ring-emerald-500 rounded-2xl shadow-inner"
                                        />
                                    </div>
                                </div>
                                <Button 
                                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
                                    onClick={() => openRegisterMutation.mutate({ 
                                        cash: parseFloat(startingCash) || 0, 
                                        card: parseFloat(startingCard) || 0 
                                    })}
                                    disabled={!startingCash || openRegisterMutation.isPending}
                                >
                                    {openRegisterMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <PlayCircle className="w-5 h-5 mr-2" />}
                                    Establish Float
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Statistics Dashboard */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between h-24">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Net Cash Flow</p>
                                        <p className="text-2xl font-black text-slate-800">Rs. {shiftStats?.expectedCash?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between h-24">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Digital Total</p>
                                        <p className="text-2xl font-black text-blue-600">Rs. {shiftStats?.expectedCard?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 col-span-2 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Responsible Cashier</p>
                                            <p className="text-sm font-black text-indigo-900">{activeShift.cashierName}</p>
                                        </div>
                                        <Badge className="bg-indigo-500 text-white border-0 font-black px-3">
                                            LIVE SESSION
                                        </Badge>
                                    </div>
                                </div>

                                <Separator className="bg-slate-100" />

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Cash</label>
                                                {actualCash && (
                                                    <Badge className={`text-[9px] h-4 font-black ${cashVariance === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                                        {cashVariance === 0 ? 'BALANCED' : `VAR: ${cashVariance}`}
                                                    </Badge>
                                                )}
                                            </div>
                                            <Input 
                                                type="number"
                                                value={actualCash}
                                                onChange={(e) => setActualCash(e.target.value)}
                                                placeholder="Physical count"
                                                className="h-14 text-2xl font-black text-center bg-slate-50 border-0 focus:ring-2 focus:ring-indigo-600 rounded-2xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actual Card</label>
                                                {actualCard && (
                                                    <Badge className={`text-[9px] h-4 font-black ${cardVariance === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                                        {cardVariance === 0 ? 'BALANCED' : `VAR: ${cardVariance}`}
                                                    </Badge>
                                                )}
                                            </div>
                                            <Input 
                                                type="number"
                                                value={actualCard}
                                                onChange={(e) => setActualCard(e.target.value)}
                                                placeholder="Bank total"
                                                className="h-14 text-2xl font-black text-center bg-slate-50 border-0 focus:ring-2 focus:ring-indigo-600 rounded-2xl"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Closing Remarks / Variance Notes</label>
                                        <Input 
                                            value={closingNotes}
                                            onChange={(e) => setClosingNotes(e.target.value)}
                                            placeholder="Reason for variance or shift summary..."
                                            className="h-12 bg-slate-50 border-0 focus:ring-2 focus:ring-indigo-600 rounded-xl font-medium"
                                        />
                                    </div>
                                </div>

                                <Button 
                                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
                                    onClick={() => closeRegisterMutation.mutate({ 
                                        actualCash: parseFloat(actualCash) || 0, 
                                        actualCard: parseFloat(actualCard) || 0,
                                        notes: closingNotes
                                    })}
                                    disabled={!actualCash || !actualCard || closeRegisterMutation.isPending}
                                >
                                    {closeRegisterMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <StopCircle className="w-5 h-5 mr-2" />}
                                    Finalize Settlement
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
