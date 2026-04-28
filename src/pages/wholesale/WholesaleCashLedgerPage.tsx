import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Separator } from '../../components/ui/separator';
import {
    Wallet,
    CreditCard,
    Banknote,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    PlayCircle,
    StopCircle,
    TrendingUp,
    Loader2,
    Receipt,
    MinusCircle,
    Truck,
    Building2
} from 'lucide-react';
import { toast } from 'sonner';

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
    expectedClosingCard: number | null;
    actualClosingCard: number | null;
    cardVariance: number | null;
    status: string;
    portal: string;
}

interface TransactionItem {
    id: string;
    type: 'sale' | 'expense';
    description: string;
    amount: number;
    method: string;
    time: Date;
    cashierName?: string;
}

export function WholesaleCashLedgerPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
    const [closingCashInput, setClosingCashInput] = useState('');
    const [closingCardInput, setClosingCardInput] = useState('');
    const [startingCashInput, setStartingCashInput] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    });

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    // ── Fetch Active Shift ──
    const { data: activeShift, isLoading: shiftLoading } = useQuery<Shift | null>({
        queryKey: ['active-shift-wholesale'],
        queryFn: async () => {
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('status', 'open')
                .eq('portal', 'wholesale')
                .order('startTime', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data || null;
        }
    });

    // ── Fetch Shift for Selected Date ──
    const { data: selectedDateShift } = useQuery<Shift | null>({
        queryKey: ['shift-for-date-wholesale', selectedDate],
        queryFn: async () => {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('portal', 'wholesale')
                .gte('startTime', start.toISOString())
                .lte('startTime', end.toISOString())
                .order('startTime', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data || null;
        }
    });

    // ── Fetch Wholesale Orders ──
    const { data: orders = [] } = useQuery({
        queryKey: ['ledger-ws-orders', selectedDate],
        queryFn: async () => {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

            const { data } = await supabase
                .from('ws_orders')
                .select('*')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .neq('status', 'cancelled');
            return data || [];
        }
    });

    // ── Fetch Expenses for Wholesale ──
    const { data: expenses = [] } = useQuery({
        queryKey: ['ledger-ws-expenses', selectedDate],
        queryFn: async () => {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

            const { data } = await supabase
                .from('expenses')
                .select('*')
                .eq('portal', 'wholesale')
                .gte('date', start.toISOString())
                .lte('date', end.toISOString());
            return data || [];
        }
    });

    // ── Fetch Shift History ──
    const { data: shiftHistory = [] } = useQuery<Shift[]>({
        queryKey: ['shift-history-wholesale'],
        queryFn: async () => {
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('status', 'closed')
                .eq('portal', 'wholesale')
                .order('startTime', { ascending: false })
                .limit(10);
            return data || [];
        }
    });

    // ── Computed Financials ──
    const financials = useMemo(() => {
        let cashIn = 0;
        let cardIn = 0;
        let cashExpenses = 0;
        let cardExpenses = 0;
        let totalOrders = 0;

        orders.forEach((o: any) => {
            totalOrders++;
            const cash = Number(o.cash_amount) || 0;
            const card = Number(o.card_amount) || 0;
            const paid = Number(o.paid_amount) || 0;

            // Legacy support: if cash/card amounts are missing, fall back to method
            if (cash === 0 && card === 0 && paid > 0) {
                const method = (o.payment_method as string || '').toLowerCase();
                if (method === 'cash' || method === 'mixed') cashIn += paid;
                else if (method === 'card') cardIn += paid;
            } else {
                cashIn += cash;
                cardIn += card;
            }
        });

        expenses.forEach((e: Record<string, unknown>) => {
            const method = (e.payment_method as string || '').toLowerCase();
            const amount = Number(e.amount) || 0;
            if (method === 'cash') {
                cashExpenses += amount;
            } else {
                cardExpenses += amount;
            }
        });

        const netCash = cashIn - cashExpenses;
        const netCard = cardIn - cardExpenses;
        const shiftForCalc = isToday ? activeShift : selectedDateShift;
        const expectedDrawer = (shiftForCalc?.startingCash || 0) + netCash;
        const expectedCardTotal = netCard;
        const hasShiftData = !!shiftForCalc;

        return {
            cashIn, cardIn, cashExpenses, cardExpenses,
            netCash, netCard,
            totalRevenue: cashIn + cardIn,
            totalExpenses: cashExpenses + cardExpenses,
            expectedDrawer,
            expectedCardTotal,
            hasShiftData,
            totalOrders
        };
    }, [orders, expenses, activeShift, selectedDateShift, isToday]);

    // ── Transaction Feed ──
    const transactions = useMemo<TransactionItem[]>(() => {
        const items: TransactionItem[] = [];

        orders.forEach((o: any) => {
            items.push({
                id: String(o.id),
                type: 'sale',
                description: `WS Order #${o.order_number} (${o.client_name})`,
                amount: Number(o.paid_amount) || 0,
                method: String(o.payment_method || 'Cash'),
                time: new Date(o.created_at as string),
                cashierName: String(o.created_by || '')
            });
        });

        expenses.forEach((e: any) => {
            items.push({
                id: String(e.id),
                type: 'expense',
                description: String(e.description || e.category || 'Expense'),
                amount: Number(e.amount) || 0,
                method: String(e.payment_method || 'Cash'),
                time: new Date(e.date as string),
            });
        });

        return items.sort((a, b) => b.time.getTime() - a.time.getTime());
    }, [orders, expenses]);

    // ── Mutations ──
    const openShiftMutation = useMutation({
        mutationFn: async (startingCash: number) => {
            const { error } = await supabase.from('shifts').insert({
                cashierId: user?.email || 'unknown',
                cashierName: user?.email?.split('@')[0] || 'Unknown',
                startTime: new Date().toISOString(),
                startingCash,
                status: 'open',
                portal: 'wholesale',
                user_id: user?.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-shift-wholesale'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history-wholesale'] });
            setIsStartDialogOpen(false);
            setStartingCashInput('');
            toast.success('GOD Shift Started');
        }
    });

    const closeShiftMutation = useMutation({
        mutationFn: async (payload: { actualCash: number, actualCard: number }) => {
            if (!activeShift) throw new Error('No active shift');
            const variance = payload.actualCash - financials.expectedDrawer;
            const cardVariance = payload.actualCard - financials.expectedCardTotal;
            
            const { error } = await supabase
                .from('shifts')
                .update({
                    endTime: new Date().toISOString(),
                    expectedClosingCash: financials.expectedDrawer,
                    actualClosingCash: payload.actualCash,
                    variance,
                    expectedClosingCard: financials.expectedCardTotal,
                    actualClosingCard: payload.actualCard,
                    cardVariance,
                    status: 'closed'
                })
                .eq('id', activeShift.id);
            if (error) throw error;
            return { variance, cardVariance };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-shift-wholesale'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history-wholesale'] });
            setIsCloseDialogOpen(false);
            setClosingCashInput('');
            setClosingCardInput('');
            toast.success('GOD Shift Terminated');
        }
    });


    if (shiftLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif] flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-sky-200/50">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        GOD HUB <span className="text-sky-600">Ledger</span>
                    </h1>
                    <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] ml-16">Wholesale distribution financial state and shift reconciliation.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white/50 p-1.5 rounded-full border border-slate-200/60 shadow-inner px-4 overflow-hidden h-[44px] flex items-center">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent font-black tracking-tight text-slate-800 focus:outline-none"
                        />
                    </div>
                    {isToday && !activeShift && (
                        <Button
                            onClick={() => setIsStartDialogOpen(true)}
                            className="h-[44px] px-8 rounded-full bg-gradient-to-r from-sky-600 to-blue-600 hover:shadow-xl hover:shadow-sky-500/20 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Initialize Shift
                        </Button>
                    )}
                    {isToday && activeShift && (
                        <Button
                            onClick={() => setIsCloseDialogOpen(true)}
                            className="h-[44px] px-8 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-[10px] uppercase tracking-widest transition-all shadow-sm"
                        >
                            <StopCircle className="w-4 h-4 mr-2" />
                            Terminate Day
                        </Button>
                    )}
                </div>
            </div>

            {/* Active Shift Banner */}
            {activeShift && isToday && (
                <div className="bg-sky-50/40 backdrop-blur-3xl border-sky-200/40 rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between shadow-xl border gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full bg-sky-500 animate-pulse shadow-[0_0_15px_rgba(14,165,233,0.5)]" />
                        <div>
                            <p className="text-[10px] font-black text-sky-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">GOD HUB Session</p>
                            <p className="text-xl font-black text-slate-800 font-['DM_Sans',sans-serif] tracking-tight">
                                Live since {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-[11px] text-sky-600 font-medium">Float: Rs. {activeShift.startingCash.toLocaleString()} • Responsible: {activeShift.cashierName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-sky-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Cash Expected</p>
                            <p className="text-2xl font-black text-slate-800 font-['DM_Sans',sans-serif]">Rs. {financials.expectedDrawer.toLocaleString()}</p>
                        </div>
                        <div className="w-px h-10 bg-sky-200/50 hidden md:block" />
                        <div className="text-right">
                            <p className="text-[10px] font-black text-blue-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Digital Total</p>
                            <p className="text-2xl font-black text-slate-800 font-['DM_Sans',sans-serif]">Rs. {financials.expectedCardTotal.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Banknote className="w-5 h-5 text-sky-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Cash In</p>
                    <p className="text-2xl font-black text-sky-600 mt-1">Rs. {financials.cashIn.toLocaleString()}</p>
                </div>

                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Digital Payments</p>
                    <p className="text-2xl font-black text-blue-600 mt-1">Rs. {financials.cardIn.toLocaleString()}</p>
                </div>

                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <MinusCircle className="w-5 h-5 text-rose-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Expenses</p>
                    <p className="text-2xl font-black text-rose-600 mt-1">Rs. {financials.cashExpenses.toLocaleString()}</p>
                </div>

                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Total Revenue</p>
                    <p className="text-2xl font-black text-indigo-600 mt-1">Rs. {financials.totalRevenue.toLocaleString()}</p>
                </div>
            </div>

            {/* Summary Table */}
            <Card className="border border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-sky-600" />
                        </div>
                        GOD HUB Financial Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                <th className="text-left py-4 px-6">Metric</th>
                                <th className="text-right py-4 px-6">Cash</th>
                                <th className="text-right py-4 px-6">Card / Bank</th>
                                <th className="text-right py-4 px-6">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="py-4 px-6 font-bold text-sky-700 flex items-center gap-2">
                                    <ArrowUpRight className="w-4 h-4" /> Paid Orders
                                </td>
                                <td className="py-4 px-6 text-right font-bold text-sky-600">+{financials.cashIn.toLocaleString()}</td>
                                <td className="py-4 px-6 text-right font-bold text-sky-600">+{financials.cardIn.toLocaleString()}</td>
                                <td className="py-4 px-6 text-right font-black text-sky-700">+{financials.totalRevenue.toLocaleString()}</td>
                            </tr>
                            <tr className="hover:bg-slate-50 transition-colors">
                                <td className="py-4 px-6 font-bold text-rose-600 flex items-center gap-2">
                                    <ArrowDownRight className="w-4 h-4" /> Expenses
                                </td>
                                <td className="py-4 px-6 text-right font-bold text-rose-500">-{financials.cashExpenses.toLocaleString()}</td>
                                <td className="py-4 px-6 text-right font-bold text-rose-500">-{financials.cardExpenses.toLocaleString()}</td>
                                <td className="py-4 px-6 text-right font-black text-rose-600">-{financials.totalExpenses.toLocaleString()}</td>
                            </tr>
                            <tr className="bg-sky-50/30">
                                <td className="py-4 px-6 text-slate-800 font-black">Net Position</td>
                                <td className="py-4 px-6 text-right text-slate-800 font-bold">{financials.netCash.toLocaleString()}</td>
                                <td className="py-4 px-6 text-right text-slate-800 font-bold">{financials.netCard.toLocaleString()}</td>
                                <td className="py-4 px-6 text-right text-sky-900 font-black text-base">{(financials.netCash + financials.netCard).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Feed + History */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-xl">
                    <CardHeader className="pb-3 border-b border-slate-100">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-slate-500" />
                            Wholesale Ledger Feed
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {transactions.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <p className="text-sm font-bold">No ledger entries for this date</p>
                                </div>
                            ) : (
                                transactions.map((t) => (
                                    <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-sky-200 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'sale' ? 'bg-sky-100' : 'bg-rose-100'}`}>
                                                {t.type === 'sale' ? <Truck className="w-4 h-4 text-sky-600" /> : <MinusCircle className="w-4 h-4 text-rose-600" />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">{t.description}</p>
                                                <p className="text-[10px] text-slate-400">{t.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {t.cashierName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-500">{t.method}</Badge>
                                            <span className={`text-sm font-black ${t.type === 'sale' ? 'text-sky-700' : 'text-rose-600'}`}>
                                                {t.type === 'sale' ? '+' : '-'}{t.amount.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-xl">
                    <CardHeader className="pb-3 border-b border-slate-100">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            GOD Shift History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {shiftHistory.map((s) => {
                                const v = s.variance ?? 0;
                                const isPerfect = v === 0;
                                return (
                                    <div key={s.id} className={`p-3 rounded-xl border ${isPerfect && (s.cardVariance ?? 0) === 0 ? 'bg-emerald-50/40 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(s.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                            <div className="flex gap-1">
                                                <Badge variant="outline" className="text-[8px] font-black">Cash {v > 0 ? '+' : ''}{v.toLocaleString()}</Badge>
                                                <Badge variant="outline" className="text-[8px] font-black">Card {s.cardVariance && s.cardVariance > 0 ? '+' : ''}{(s.cardVariance ?? 0).toLocaleString()}</Badge>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div>
                                                <p className="text-slate-400">Cash Actual</p>
                                                <p className="font-black">{(s.actualClosingCash ?? 0).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-slate-400">Card Actual</p>
                                                <p className="font-black">{(s.actualClosingCard ?? 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Start Shift Dialog */}
            <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            <PlayCircle className="w-5 h-5 text-sky-600" />
                            Initialize Wholesale Shift
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-slate-500">Enter the starting physical cash float for the GOD HUB warehouse drawer.</p>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Opening Cash (Nrs.)</label>
                            <Input
                                type="number"
                                value={startingCashInput}
                                onChange={(e) => setStartingCashInput(e.target.value)}
                                placeholder="e.g. 5000"
                                className="h-12 text-lg font-black text-center"
                                autoFocus
                            />
                        </div>
                        <Button
                            onClick={() => openShiftMutation.mutate(parseFloat(startingCashInput) || 0)}
                            disabled={!startingCashInput || openShiftMutation.isPending}
                            className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white font-black"
                        >
                            Open GOD Register
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Close Shift Dialog */}
            <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-rose-600">
                            <StopCircle className="w-5 h-5" />
                            Terminate GOD Shift
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Expected Cash</span>
                                <span className="font-black text-slate-800">Nrs. {financials.expectedDrawer.toLocaleString()}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Expected Digital</span>
                                <span className="font-black text-slate-800">Nrs. {financials.expectedCardTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-600 uppercase">Actual Cash</label>
                                <Input
                                    type="number"
                                    value={closingCashInput}
                                    onChange={(e) => setClosingCashInput(e.target.value)}
                                    placeholder="Count cash"
                                    className="h-11 text-center font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-600 uppercase">Actual Card</label>
                                <Input
                                    type="number"
                                    value={closingCardInput}
                                    onChange={(e) => setClosingCardInput(e.target.value)}
                                    placeholder="Bank total"
                                    className="h-11 text-center font-bold"
                                />
                            </div>
                        </div>

                        <Button
                            onClick={() => closeShiftMutation.mutate({ 
                                actualCash: parseFloat(closingCashInput) || 0, 
                                actualCard: parseFloat(closingCardInput) || 0 
                            })}
                            disabled={!closingCashInput || !closingCardInput || closeShiftMutation.isPending}
                            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-black"
                        >
                            Finalize Shift Record
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
