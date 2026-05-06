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
    Search,
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
    notes?: string;
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

    // UI & Modal State
    const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
    const [closingCashInput, setClosingCashInput] = useState('');
    const [closingCardInput, setClosingCardInput] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [startingCashInput, setStartingCashInput] = useState('');
    const [startingCardInput, setStartingCardInput] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    });

    // Shift Audit Ledger State
    const [shiftSearch, setShiftSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'balanced' | 'variance'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage] = useState(10);

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
                .limit(100);
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

    // ── Filtered & Paginated Shift History ──
    const filteredShifts = useMemo(() => {
        return shiftHistory.filter(s => {
            const matchesSearch = s.cashierName.toLowerCase().includes(shiftSearch.toLowerCase());
            const totalVariance = (s.variance ?? 0) + (s.cardVariance ?? 0);
            const isPerfect = totalVariance === 0;
            
            if (statusFilter === 'balanced') return matchesSearch && isPerfect;
            if (statusFilter === 'variance') return matchesSearch && !isPerfect;
            return matchesSearch;
        });
    }, [shiftHistory, shiftSearch, statusFilter]);

    const totalPages = Math.ceil(filteredShifts.length / rowsPerPage);
    const paginatedShifts = filteredShifts.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    // ── Mutations ──
    const openShiftMutation = useMutation({
        mutationFn: async (payload: { cash: number, card: number }) => {
            const { error } = await supabase.from('shifts').insert({
                cashierId: user?.email || 'unknown',
                cashierName: user?.email?.split('@')[0] || 'Unknown',
                startTime: new Date().toISOString(),
                startingCash: payload.cash,
                startingCard: payload.card,
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
            setStartingCardInput('');
            toast.success('Wholesale Register Opened');
        }
    });

    const closeShiftMutation = useMutation({
        mutationFn: async (payload: { actualCash: number, actualCard: number, notes?: string }) => {
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
                    status: 'closed',
                    notes: payload.notes
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
            setClosingNotes('');
            toast.success('Wholesale Reconciliation Complete');
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
        <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-2">
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

            {/* Transaction Feed - TOP SECTION */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-xl mb-8">
                <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 font-['DM_Sans',sans-serif]">
                        <Receipt className="w-4 h-4 text-slate-500" />
                        Wholesale Transaction Feed
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-black uppercase px-3 py-1 bg-white text-slate-400 border-slate-200">
                        {transactions.length} Records
                    </Badge>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto custom-scrollbar">
                        {transactions.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 font-medium">
                                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                <p className="text-xs">No activity recorded for this period.</p>
                            </div>
                        ) : (
                            transactions.map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'sale' ? 'bg-sky-50 text-sky-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {t.type === 'sale' ? <Truck className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{t.description}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {t.cashierName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase px-3 py-0.5 border-slate-200 text-slate-500">{t.method}</Badge>
                                        <span className={`text-sm font-bold tabular-nums ${t.type === 'sale' ? 'text-sky-600' : 'text-rose-600'}`}>
                                            {t.type === 'sale' ? '+' : '−'}Rs. {t.amount.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Financial Summary Table */}
            <Card className="border border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2 font-['DM_Sans',sans-serif]">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-sky-600" />
                        </div>
                        GOD HUB Financial Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold font-['DM_Sans',sans-serif]">
                                    <th className="text-left py-4 px-6">Metric</th>
                                    <th className="text-right py-4 px-6">💵 Cash</th>
                                    <th className="text-right py-4 px-6">💳 Digital</th>
                                    <th className="text-right py-4 px-6">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-['DM_Sans',sans-serif]">
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-6 font-bold text-sky-700 flex items-center gap-2">
                                        <ArrowUpRight className="w-4 h-4" /> Wholesale Sales
                                    </td>
                                    <td className="py-4 px-6 text-right font-bold text-sky-600">+{financials.cashIn.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-bold text-sky-600">+{financials.cardIn.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-black text-sky-700">+{financials.totalRevenue.toLocaleString()}</td>
                                </tr>
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-6 font-bold text-rose-600 flex items-center gap-2">
                                        <ArrowDownRight className="w-4 h-4" /> Operational Expenses
                                    </td>
                                    <td className="py-4 px-6 text-right font-bold text-rose-500">-{financials.cashExpenses.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-bold text-rose-500">-{financials.cardExpenses.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-black text-rose-600">-{financials.totalExpenses.toLocaleString()}</td>
                                </tr>
                                <tr className="bg-sky-50/30">
                                    <td className="py-4 px-6 text-slate-800 font-black">Net Distribution Flow</td>
                                    <td className="py-4 px-6 text-right text-slate-800 font-bold">{financials.netCash.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right text-slate-800 font-bold">{financials.netCard.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right text-sky-900 font-black text-base">{(financials.netCash + financials.netCard).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Historical Shift Reconciliation Audit Ledger */}
            <Card className="border border-slate-200 shadow-sm bg-white rounded-xl overflow-hidden mt-8">
                <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                <Clock className="w-4 h-4 text-slate-500" />
                                Historical Shift Reconciliation
                            </CardTitle>
                            <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-widest">Formal audit ledger for wholesale operations</p>
                        </div>
                        
                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input 
                                    placeholder="Search Manager..." 
                                    className="h-9 w-[180px] pl-9 text-xs border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-500"
                                    value={shiftSearch}
                                    onChange={(e) => {
                                        setShiftSearch(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                {['all', 'balanced', 'variance'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => {
                                            setStatusFilter(filter as any);
                                            setCurrentPage(1);
                                        }}
                                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                                            statusFilter === filter 
                                                ? 'bg-white text-sky-600 shadow-sm font-black' 
                                                : 'text-slate-500 hover:text-slate-700 font-bold'
                                        }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="py-5 px-8 text-left font-black">Session Period</th>
                                    <th className="py-5 px-8 text-left font-black">Operator</th>
                                    <th className="py-5 px-8 text-right font-black">Target</th>
                                    <th className="py-5 px-8 text-right font-black">Actual</th>
                                    <th className="py-5 px-8 text-right font-black">Variance</th>
                                    <th className="py-5 px-8 text-left font-black">Audit Notes</th>
                                    <th className="py-5 px-8 text-center font-black">Audit Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-slate-400 font-medium italic">
                                            {shiftSearch || statusFilter !== 'all' ? 'No records match your filters.' : 'No historical shift data recorded.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedShifts.map((s) => {
                                        const v = s.variance ?? 0;
                                        const cv = s.cardVariance ?? 0;
                                        const totalVariance = v + cv;
                                        const isPerfect = totalVariance === 0;
                                        const isShort = totalVariance < 0;
                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="py-6 px-8">
                                                    <p className="font-bold text-slate-800">{new Date(s.startTime).toLocaleDateString()}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {s.endTime ? new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open'}</p>
                                                </td>
                                                <td className="py-6 px-8">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-black text-sky-600 uppercase">
                                                            {s.cashierName.charAt(0)}
                                                        </div>
                                                        <span className="font-bold text-slate-700">{s.cashierName}</span>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8 text-right font-medium text-slate-500">
                                                    <p>Cash: {(s.expectedClosingCash ?? 0).toLocaleString()}</p>
                                                    <p className="text-[10px]">Bank: {(s.expectedClosingCard ?? 0).toLocaleString()}</p>
                                                </td>
                                                <td className="py-6 px-8 text-right font-bold text-slate-800">
                                                    <p>Cash: {(s.actualClosingCash ?? 0).toLocaleString()}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">Bank: {(s.actualClosingCard ?? 0).toLocaleString()}</p>
                                                </td>
                                                <td className={`py-6 px-8 text-right font-black tabular-nums text-sm ${
                                                    isPerfect ? 'text-emerald-600' : isShort ? 'text-rose-600' : 'text-blue-600'
                                                }`}>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-base">{totalVariance > 0 ? '+' : ''}{totalVariance.toLocaleString()}</span>
                                                        <div className="flex gap-2 mt-1">
                                                            {v !== 0 && (
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1 rounded ${v < 0 ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                    Cash: {v > 0 ? '+' : ''}{v}
                                                                </span>
                                                            )}
                                                            {cv !== 0 && (
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1 rounded ${cv < 0 ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                    Card: {cv > 0 ? '+' : ''}{cv}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8">
                                                    <div className="max-w-[150px] truncate text-[10px] font-medium text-slate-500 italic" title={s.notes || ''}>
                                                        {s.notes || '—'}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8 text-center">
                                                    {totalVariance === 0 ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-black uppercase text-[9px] px-2 py-0.5">Balanced</Badge>
                                                    ) : (
                                                        <Badge className={`${totalVariance < 0 ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-blue-100 text-blue-700 border-blue-200'} font-black uppercase text-[9px] px-2 py-0.5`}>
                                                            {totalVariance < 0 ? 'Deficit' : 'Surplus'}
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredShifts.length)} of {filteredShifts.length} Sessions
                        </p>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="h-8 text-[10px] font-black uppercase border-slate-200"
                            >
                                Previous
                            </Button>
                            {[...Array(totalPages)].map((_, i) => (
                                <Button
                                    key={i}
                                    variant={currentPage === i + 1 ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`h-8 w-8 text-[10px] font-black ${currentPage === i + 1 ? 'bg-sky-600 hover:bg-sky-700' : 'border-slate-200'}`}
                                >
                                    {i + 1}
                                </Button>
                            ))}
                            <Button 
                                variant="outline" 
                                size="sm" 
                                disabled={currentPage === totalPages || totalPages === 0}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="h-8 text-[10px] font-black uppercase border-slate-200"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Starting Cash (Nrs.)</label>
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
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Starting Card (Nrs.)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={startingCardInput}
                                    onChange={(e) => setStartingCardInput(e.target.value)}
                                    placeholder="0"
                                    className="h-12 text-lg font-black text-center"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={() => openShiftMutation.mutate({ 
                                cash: parseFloat(startingCashInput) || 0, 
                                card: parseFloat(startingCardInput) || 0 
                            })}
                            disabled={!startingCashInput || openShiftMutation.isPending}
                            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm"
                        >
                            {openShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Open Drawer
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
                                <label className="text-[10px] font-black text-slate-600 uppercase">Actual Digital</label>
                                <Input
                                    type="number"
                                    value={closingCardInput}
                                    onChange={(e) => setClosingCardInput(e.target.value)}
                                    placeholder="Bank total"
                                    className="h-11 text-center font-bold"
                                />
                            </div>
                        </div>
                        
                        {/* Closing Remarks */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Closing Remarks / Audit Notes</label>
                            <Input
                                value={closingNotes}
                                onChange={(e) => setClosingNotes(e.target.value)}
                                placeholder="Explain any shortages or overages..."
                                className="h-10 text-sm font-medium"
                            />
                        </div>

                        <Button
                            onClick={() => closeShiftMutation.mutate({ 
                                actualCash: parseFloat(closingCashInput) || 0, 
                                actualCard: parseFloat(closingCardInput) || 0,
                                notes: closingNotes
                            })}
                            disabled={!closingCashInput || !closingCardInput || closeShiftMutation.isPending}
                            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-black text-sm"
                        >
                            {closeShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Terminate Shift & Lock Data
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
