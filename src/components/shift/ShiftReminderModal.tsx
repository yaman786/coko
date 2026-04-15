import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
    PlayCircle,
    StopCircle,
    AlertTriangle,
    Loader2,
    Clock,
    Sunrise,
    Moon,
} from 'lucide-react';
import { toast } from 'sonner';

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const EVENING_HOUR = 20; // 8 PM

interface Shift {
    id: number;
    cashierId: string;
    cashierName: string;
    startTime: string;
    endTime: string | null;
    startingCash: number;
    expectedClosingCash: number | null;
    actualClosingCash: number | null;
    variance: number | null;
    status: string;
}

export function ShiftReminderModal() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseStaleModal, setShowCloseStaleModal] = useState(false);
    const [showCloseEveningModal, setShowCloseEveningModal] = useState(false);
    const [startingCashInput, setStartingCashInput] = useState('');
    const [closingCashInput, setClosingCashInput] = useState('');

    const isSnoozed = useCallback(() => {
        const snoozeUntil = localStorage.getItem('shift-snooze-until');
        if (!snoozeUntil) return false;
        return Date.now() < parseInt(snoozeUntil, 10);
    }, []);

    // ── Fetch Active Shift ──
    const { data: activeShift, isLoading } = useQuery<Shift | null>({
        queryKey: ['active-shift'],
        queryFn: async () => {
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('status', 'open')
                .order('startTime', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data || null;
        },
        refetchInterval: 60000, // Re-check every minute
    });

    // ── Detect Stale Shift (from a previous day) ──
    const isStaleShift = useCallback(() => {
        if (!activeShift) return false;
        const shiftDate = new Date(activeShift.startTime).toDateString();
        const today = new Date().toDateString();
        return shiftDate !== today;
    }, [activeShift]);

    // ── Detect Evening (after 8 PM) ──
    const isEvening = useCallback(() => {
        return new Date().getHours() >= EVENING_HOUR;
    }, []);

    // ── Calculate expected cash for stale shift close ──
    const fetchExpectedCash = useCallback(async () => {
        if (!activeShift) return 0;
        const shiftStart = new Date(activeShift.startTime);
        const shiftEnd = new Date(); // Now or end of that day

        const { data: orders } = await supabase
            .from('orders')
            .select('totalAmount, cashAmount, paymentMethod, isWaste')
            .gte('createdAt', shiftStart.toISOString())
            .lte('createdAt', shiftEnd.toISOString())
            .eq('status', 'completed');

        const { data: expenses } = await supabase
            .from('expenses')
            .select('amount, payment_method')
            .gte('date', shiftStart.toISOString())
            .lte('date', shiftEnd.toISOString());

        let cashIn = 0;
        let cashOut = 0;

        (orders || []).forEach((o: Record<string, unknown>) => {
            if (o.isWaste) return;
            const method = (o.paymentMethod as string || '').toLowerCase();
            if (method === 'cash') cashIn += Number(o.totalAmount) || 0;
            else if (method === 'split') cashIn += Number(o.cashAmount) || 0;
        });

        (expenses || []).forEach((e: Record<string, unknown>) => {
            if ((e.payment_method as string || '').toLowerCase() === 'cash') {
                cashOut += Number(e.amount) || 0;
            }
        });

        return activeShift.startingCash + cashIn - cashOut;
    }, [activeShift]);

    // ── Initial Check on Mount ──
    useEffect(() => {
        if (isLoading || !user) return;

        // Priority 1: Stale shift from previous day (CANNOT BE SNOOZED)
        if (isStaleShift()) {
            setShowCloseStaleModal(true);
            return;
        }

        if (isSnoozed()) return;

        // Priority 2: No active shift → prompt to open
        if (!activeShift) {
            setShowOpenModal(true);
            return;
        }

        // Priority 3: Evening nag
        if (activeShift && isEvening()) {
            setShowCloseEveningModal(true);
        }
    }, [isLoading, activeShift, user, isStaleShift, isEvening, isSnoozed]);

    // ── Reminder Loop (Checks every minute) ──
    useEffect(() => {
        if (isLoading) return;

        const interval = setInterval(() => {
            if (isStaleShift() || isSnoozed()) return;

            // If no shift
            if (!activeShift && !showOpenModal) {
                setShowOpenModal(true);
            }

            // If shift is active and it's evening
            if (activeShift && isEvening() && !showCloseEveningModal) {
                setShowCloseEveningModal(true);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [activeShift, isLoading, isStaleShift, isEvening, isSnoozed, showOpenModal, showCloseEveningModal]);

    // ── Open Shift Mutation ──
    const openShiftMutation = useMutation({
        mutationFn: async (startingCash: number) => {
            const { error } = await supabase.from('shifts').insert({
                cashierId: user?.email || 'unknown',
                cashierName: user?.email?.split('@')[0] || 'Unknown',
                startTime: new Date().toISOString(),
                startingCash,
                status: 'open',
                user_id: user?.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-shift'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            setShowOpenModal(false);
            setStartingCashInput('');
            toast.success('Day Started!', { description: `Drawer opened with Nrs. ${startingCashInput}` });
            api.logActivity({
                action: 'SHIFT_OPENED',
                category: 'POS',
                description: `Shift opened with Nrs. ${startingCashInput} starting cash.`,
                metadata: { startingCash: parseFloat(startingCashInput) },
                actor_email: user?.email || 'system',
                actor_name: user?.email?.split('@')[0] || 'System',
            });
        },
        onError: (err: Error) => toast.error('Failed to open shift', { description: err.message })
    });

    // ── Close Stale Shift Mutation ──
    const closeShiftMutation = useMutation({
        mutationFn: async (actualCash: number) => {
            if (!activeShift) throw new Error('No active shift');
            const expectedCash = await fetchExpectedCash();
            const variance = actualCash - expectedCash;
            const { error } = await supabase
                .from('shifts')
                .update({
                    endTime: new Date().toISOString(),
                    expectedClosingCash: expectedCash,
                    actualClosingCash: actualCash,
                    variance,
                    status: 'closed'
                })
                .eq('id', activeShift.id);
            if (error) throw error;
            return { variance, expectedCash };
        },
        onSuccess: ({ variance }) => {
            queryClient.invalidateQueries({ queryKey: ['active-shift'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            setShowCloseStaleModal(false);
            setShowCloseEveningModal(false);
            setClosingCashInput('');
            const desc = variance === 0
                ? 'Perfect match!'
                : variance > 0 ? `OVER by Nrs. ${variance}` : `SHORT by Nrs. ${Math.abs(variance)}`;
            toast.success('Shift Closed', { description: desc });
            api.logActivity({
                action: 'SHIFT_CLOSED',
                category: 'POS',
                description: `Shift closed. Variance: Nrs. ${variance}`,
                metadata: { actual: parseFloat(closingCashInput), variance },
                actor_email: user?.email || 'system',
                actor_name: user?.email?.split('@')[0] || 'System',
            });
        },
        onError: (err: Error) => toast.error('Failed to close shift', { description: err.message })
    });

    const handleSkip = () => {
        setShowOpenModal(false);
        setShowCloseEveningModal(false);
        localStorage.setItem('shift-snooze-until', (Date.now() + REMINDER_INTERVAL_MS).toString());
    };

    if (isLoading) return null;

    return (
        <>
            {/* ── Open Shift Modal (Morning Nag) ── */}
            <Dialog open={showOpenModal} onOpenChange={(open) => { if (!open) handleSkip(); }}>
                <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-200/50">
                                <Sunrise className="w-5 h-5 text-white" />
                            </div>
                            Good Morning!
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-slate-500 leading-relaxed">
                            No active shift detected. Count the cash in your drawer and enter the starting amount to begin tracking today's transactions.
                        </p>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Starting Cash (Nrs.)</label>
                            <Input
                                type="number"
                                min="0"
                                value={startingCashInput}
                                onChange={(e) => setStartingCashInput(e.target.value)}
                                placeholder="e.g. 5000"
                                className="h-12 text-lg font-black text-center"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => openShiftMutation.mutate(parseFloat(startingCashInput) || 0)}
                                disabled={!startingCashInput || openShiftMutation.isPending}
                                className="flex-1 h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black"
                            >
                                {openShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Open Drawer
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleSkip}
                                className="h-11 text-slate-500 font-bold border-slate-200"
                            >
                                Skip
                            </Button>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center font-medium">
                            We'll remind you again in 30 minutes if skipped
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Close Stale Shift Modal (Yesterday's unclosed shift) ── */}
            <Dialog open={showCloseStaleModal} onOpenChange={() => {}}>
                <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-lg font-black text-red-700">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200/50">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            Unclosed Shift Detected!
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                            <p className="text-sm text-red-700 font-bold mb-1">
                                A shift from {activeShift ? new Date(activeShift.startTime).toLocaleDateString() : '—'} was never closed.
                            </p>
                            <p className="text-xs text-red-500">
                                Starting Cash: Nrs. {(activeShift?.startingCash || 0).toLocaleString()} •
                                Opened by: {activeShift?.cashierName || 'Unknown'}
                            </p>
                        </div>
                        <p className="text-sm text-slate-500">
                            Please enter the actual cash that was in the drawer when the shift ended. This will be logged permanently.
                        </p>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-red-600 uppercase tracking-wider">Actual Closing Cash (Nrs.)</label>
                            <Input
                                type="number"
                                min="0"
                                value={closingCashInput}
                                onChange={(e) => setClosingCashInput(e.target.value)}
                                placeholder="Enter the actual cash count"
                                className="h-12 text-lg font-black text-center border-red-200 focus:ring-red-500"
                                autoFocus
                            />
                        </div>
                        <Button
                            onClick={() => closeShiftMutation.mutate(parseFloat(closingCashInput) || 0)}
                            disabled={!closingCashInput || closeShiftMutation.isPending}
                            className="w-full h-11 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black"
                        >
                            {closeShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <StopCircle className="w-4 h-4 mr-2" />
                            Close Yesterday's Shift
                        </Button>
                        <p className="text-[10px] text-red-400 text-center font-medium">
                            ⚠️ This action cannot be undone. The variance will be permanently logged.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Close Evening Modal (End of Day Nag) ── */}
            <Dialog open={showCloseEveningModal} onOpenChange={(open) => { if (!open) handleSkip(); }}>
                <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2.5 text-lg font-black">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/50">
                                <Moon className="w-5 h-5 text-white" />
                            </div>
                            Time to Close?
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-slate-500 leading-relaxed">
                            It's getting late and your shift is still open. If you're closing up, count the cash and close the drawer now.
                        </p>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="w-3.5 h-3.5" />
                                Shift opened at {activeShift ? new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                {' • '}Starting Cash: Nrs. {(activeShift?.startingCash || 0).toLocaleString()}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-600 uppercase tracking-wider">Actual Cash in Drawer (Nrs.)</label>
                            <Input
                                type="number"
                                min="0"
                                value={closingCashInput}
                                onChange={(e) => setClosingCashInput(e.target.value)}
                                placeholder="Count and enter exact amount"
                                className="h-12 text-lg font-black text-center"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => closeShiftMutation.mutate(parseFloat(closingCashInput) || 0)}
                                disabled={!closingCashInput || closeShiftMutation.isPending}
                                className="flex-1 h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black"
                            >
                                {closeShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                <StopCircle className="w-4 h-4 mr-2" />
                                Close Drawer
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleSkip}
                                className="h-11 text-slate-500 font-bold border-slate-200"
                            >
                                Not Yet
                            </Button>
                        </div>
                        <p className="text-[10px] text-slate-400 text-center font-medium">
                            We'll remind you again in 30 minutes
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
