import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
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
    ShoppingBag,
    MinusCircle,
    Truck,
    Search,
    User,
    ShieldCheck,
    History
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

export function CashLedgerPage() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
    const [isBackdateDialogOpen, setIsBackdateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [startingCashInput, setStartingCashInput] = useState('');
    const [closingCashInput, setClosingCashInput] = useState('');
    const [closingCardInput, setClosingCardInput] = useState('');
    const [backdateStartingCash, setBackdateStartingCash] = useState('');
    const [backdateClosingCash, setBackdateClosingCash] = useState('');
    const [backdateClosingCard, setBackdateClosingCard] = useState('');
    const [editStartingCash, setEditStartingCash] = useState('');
    const [editClosingCash, setEditClosingCash] = useState('');
    const [editClosingCard, setEditClosingCard] = useState('');
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
        queryKey: ['active-shift'],
        queryFn: async () => {
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('status', 'open')
                .eq('portal', 'retail')
                .order('startTime', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data || null;
        }
    });

    // ── Fetch Shift for Selected Date (historical) ──
    const { data: selectedDateShift } = useQuery<Shift | null>({
        queryKey: ['shift-for-date', selectedDate],
        queryFn: async () => {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('portal', 'retail')
                .gte('startTime', start.toISOString())
                .lte('startTime', end.toISOString())
                .order('startTime', { ascending: false })
                .limit(1)
                .maybeSingle();
            return data || null;
        }
    });

    // ── Fetch Completed Orders for Selected Date ──
    const { data: orders = [] } = useQuery({
        queryKey: ['ledger-orders', selectedDate],
        queryFn: async () => {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

            const { data } = await supabase
                .from('orders')
                .select('*')
                .gte('createdAt', start.toISOString())
                .lte('createdAt', end.toISOString())
                .eq('status', 'completed');
            return data || [];
        }
    });

    // ── Fetch Expenses for Selected Date ──
    const { data: expenses = [] } = useQuery({
        queryKey: ['ledger-expenses', selectedDate],
        queryFn: async () => {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

            const { data } = await supabase
                .from('expenses')
                .select('*')
                .eq('portal', 'retail')
                .gte('date', start.toISOString())
                .lte('date', end.toISOString());
            return data || [];
        }
    });

    // ── Fetch Supplier Payments for Selected Date ──
    const { data: supplierPayments = [] } = useQuery({
        queryKey: ['ledger-supplier-payments', selectedDate],
        queryFn: async () => {
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(selectedDate);
            end.setHours(23, 59, 59, 999);

            const { data } = await supabase
                .from('supplier_transactions')
                .select(`
                    *,
                    suppliers!inner (name, portal)
                `)
                .eq('suppliers.portal', 'retail')
                .eq('type', 'PAYMENT')
                .eq('is_deleted', false)
                .gte('date', start.toISOString())
                .lte('date', end.toISOString());
            return data || [];
        }
    });

    // ── Fetch Shift History ──
    const { data: shiftHistory = [] } = useQuery<Shift[]>({
        queryKey: ['shift-history'],
        queryFn: async () => {
            const { data } = await supabase
                .from('shifts')
                .select('*')
                .eq('status', 'closed')
                .eq('portal', 'retail')
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
        let totalExpenseCount = 0;

        orders.forEach((o: Record<string, unknown>) => {
            if (o.isWaste) return;
            totalOrders++;
            const method = (o.paymentMethod as string || '').toLowerCase();
            const total = Number(o.totalAmount) || 0;
            const cash = Number(o.cashAmount) || 0;
            const card = Number(o.cardAmount) || 0;

            if (method === 'cash') {
                cashIn += total;
            } else if (method === 'card') {
                cardIn += total;
            } else if (method === 'split') {
                cashIn += cash;
                cardIn += card;
            } else {
                // Complimentary / Other — no cash movement
            }
        });

        expenses.forEach((e: Record<string, unknown>) => {
            totalExpenseCount++;
            const method = (e.payment_method as string || '').toLowerCase();
            const amount = Number(e.amount) || 0;
            if (method === 'cash') {
                cashExpenses += amount;
            } else {
                cardExpenses += amount;
            }
        });

        supplierPayments.forEach((sp: any) => {
            const method = (sp.payment_method as string || '').toLowerCase();
            const amount = Number(sp.amount) || 0;
            if (method === 'cash') {
                cashExpenses += amount;
            } else {
                cardExpenses += amount;
            }
        });

        const netCash = cashIn - cashExpenses;
        const netCard = cardIn - cardExpenses;
        // Use selectedDateShift for historical, activeShift for today
        const shiftForCalc = isToday ? activeShift : selectedDateShift;
        const expectedDrawer = (shiftForCalc?.startingCash || 0) + netCash;
        const expectedCardTotal = netCard; // Card usually starts at 0 every shift
        const hasShiftData = !!shiftForCalc;

        return {
            cashIn, cardIn, cashExpenses, cardExpenses,
            netCash, netCard,
            totalRevenue: cashIn + cardIn,
            totalExpenses: cashExpenses + cardExpenses,
            expectedDrawer,
            expectedCardTotal,
            hasShiftData,
            totalOrders,
            totalExpenseCount
        };
    }, [orders, expenses, supplierPayments, activeShift, selectedDateShift, isToday]);

    // ── Transaction Feed ──
    const transactions = useMemo<TransactionItem[]>(() => {
        const items: TransactionItem[] = [];

        orders.forEach((o: Record<string, unknown>) => {
            if (o.isWaste) return;
            const orderItems = (o.items as Array<{name: string}>) || [];
            const itemNames = orderItems.map((i) => i.name).join(', ');
            items.push({
                id: String(o.id),
                type: 'sale',
                description: itemNames || 'POS Sale',
                amount: Number(o.totalAmount) || 0,
                method: String(o.paymentMethod || 'Cash'),
                time: new Date(o.createdAt as string),
                cashierName: String(o.cashierName || '')
            });
        });

        expenses.forEach((e: Record<string, unknown>) => {
            items.push({
                id: String(e.id),
                type: 'expense',
                description: String(e.description || e.category || 'Expense'),
                amount: Number(e.amount) || 0,
                method: String(e.payment_method || 'Cash'),
                time: new Date(e.date as string),
            });
        });

        supplierPayments.forEach((sp: any) => {
            items.push({
                id: String(sp.id),
                type: 'expense', // Treating as expense for feed categorization
                description: `Payment: ${sp.suppliers?.name || 'Supplier'}`,
                amount: Number(sp.amount) || 0,
                method: String(sp.payment_method || 'Cash'),
                time: new Date(sp.date as string),
            });
        });

        return items.sort((a, b) => b.time.getTime() - a.time.getTime());
    }, [orders, expenses, supplierPayments]);

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
        mutationFn: async (startingCash: number) => {
            const { error } = await supabase.from('shifts').insert({
                cashierId: user?.email || 'unknown',
                cashierName: user?.email?.split('@')[0] || 'Unknown',
                startTime: new Date().toISOString(),
                startingCash,
                status: 'open',
                portal: 'retail',
                user_id: user?.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-shift'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            setIsStartDialogOpen(false);
            setStartingCashInput('');
            toast.success('Day Started', { description: `Drawer opened with Nrs. ${startingCashInput}` });
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
        onSuccess: ({ variance, cardVariance }) => {
            queryClient.invalidateQueries({ queryKey: ['active-shift'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            setIsCloseDialogOpen(false);
            setClosingCashInput('');
            setClosingCardInput('');
            
            const cashDesc = variance === 0
                ? 'Cash matches.'
                : variance > 0 ? `Cash OVER by Nrs. ${variance}` : `Cash SHORT by Nrs. ${Math.abs(variance)}`;
            const cardDesc = cardVariance === 0
                ? 'Card matches.'
                : cardVariance > 0 ? `Card OVER by Nrs. ${cardVariance}` : `Card SHORT by Nrs. ${Math.abs(cardVariance)}`;
                
            toast.success('Day Closed', { description: `${cashDesc} ${cardDesc}` });
            
            api.logActivity({
                action: 'SHIFT_CLOSED',
                category: 'POS',
                description: `Shift closed. Cash Variance: Nrs. ${variance}, Card Variance: Nrs. ${cardVariance}`,
                metadata: { 
                    expectedCash: financials.expectedDrawer, 
                    actualCash: parseFloat(closingCashInput), 
                    variance,
                    expectedCard: financials.expectedCardTotal,
                    actualCard: parseFloat(closingCardInput),
                    cardVariance
                },
                actor_email: user?.email || 'system',
                actor_name: user?.email?.split('@')[0] || 'System',
            });
        },
        onError: (err: Error) => toast.error('Failed to close shift', { description: err.message })
    });

    // ── Backdate Shift Mutation (Historical) ──
    const addHistoricalShiftMutation = useMutation({
        mutationFn: async () => {
            const start = parseFloat(backdateStartingCash) || 0;
            const actual = parseFloat(backdateClosingCash) || 0;
            const actualCard = parseFloat(backdateClosingCard) || 0;
            const expected = start + financials.netCash; // netCash is based on selectedDate
            const variance = actual - expected;
            const expectedCard = financials.netCard;
            const cardVariance = actualCard - expectedCard;

            const shiftStart = new Date(selectedDate);
            shiftStart.setHours(9, 0, 0, 0); // Pretend it started at 9 AM
            const shiftEnd = new Date(selectedDate);
            shiftEnd.setHours(21, 0, 0, 0); // Pretend it ended at 9 PM

            const { error } = await supabase.from('shifts').insert({
                cashierId: user?.email || 'unknown',
                cashierName: user?.email?.split('@')[0] || 'Unknown',
                startTime: shiftStart.toISOString(),
                endTime: shiftEnd.toISOString(),
                startingCash: start,
                expectedClosingCash: expected,
                actualClosingCash: actual,
                variance,
                expectedClosingCard: expectedCard,
                actualClosingCard: actualCard,
                cardVariance,
                status: 'closed',
                portal: 'retail',
                user_id: user?.id
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-for-date'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            setIsBackdateDialogOpen(false);
            setBackdateStartingCash('');
            setBackdateClosingCash('');
            setBackdateClosingCard('');
            toast.success('Historical Shift Added', { description: 'Past date successfully backdated.' });
        },
        onError: (err: Error) => toast.error('Failed to backdate shift', { description: err.message })
    });

    // ── Edit Shift Mutation (Correction) ──
    const editShiftMutation = useMutation({
        mutationFn: async () => {
            if (!selectedDateShift) throw new Error('No shift to edit');
            const start = parseFloat(editStartingCash) || 0;
            const actual = parseFloat(editClosingCash) || 0;
            const actualCard = parseFloat(editClosingCard) || 0;
            const expected = start + financials.netCash;
            const variance = actual - expected;
            const expectedCard = financials.netCard;
            const cardVariance = actualCard - expectedCard;

            const { error } = await supabase
                .from('shifts')
                .update({
                    startingCash: start,
                    expectedClosingCash: expected,
                    actualClosingCash: actual,
                    variance,
                    expectedClosingCard: expectedCard,
                    actualClosingCard: actualCard,
                    cardVariance,
                })
                .eq('id', selectedDateShift.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-for-date'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            if (isToday) queryClient.invalidateQueries({ queryKey: ['active-shift'] });
            setIsEditDialogOpen(false);
            toast.success('Shift Updated', { description: 'Values successfully corrected.' });
        },
        onError: (err: Error) => toast.error('Failed to edit shift', { description: err.message })
    });

    if (shiftLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-2">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif] flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200/50">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        Cash Flow <span className="text-emerald-600">Ledger</span>
                    </h1>
                    <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] ml-16">Real-time audit of every transaction and shift variance.</p>
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
                            className="h-[44px] px-8 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-xl hover:shadow-emerald-500/20 text-white text-[10px] font-black uppercase tracking-widest transition-all"
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
                <div className="bg-emerald-50/40 backdrop-blur-3xl border-emerald-200/40 rounded-[2rem] p-6 flex flex-col md:flex-row md:items-center justify-between shadow-xl border gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                        <div>
                            <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Current Session State</p>
                            <p className="text-xl font-black text-emerald-800 font-['DM_Sans',sans-serif] tracking-tight">
                                Live since {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-[11px] text-emerald-600 font-medium">Float: Rs. {activeShift.startingCash.toLocaleString()} • Responsible: {activeShift.cashierName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Cash Drawer</p>
                            <p className="text-2xl font-black text-emerald-800 font-['DM_Sans',sans-serif]">Rs. {financials.expectedDrawer.toLocaleString()}</p>
                        </div>
                        <div className="w-px h-10 bg-emerald-200/50 hidden md:block" />
                        <div className="text-right">
                            <p className="text-[10px] font-black text-blue-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Digital Total</p>
                            <p className="text-2xl font-black text-blue-800 font-['DM_Sans',sans-serif]">Rs. {financials.expectedCardTotal.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Historical: No Shift Data Banner */}
            {!isToday && !financials.hasShiftData && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-slate-400 flex-none" />
                        <div>
                            <p className="text-sm font-bold text-slate-600">No shift data for this date</p>
                            <p className="text-[11px] text-slate-400 font-medium">Drawer tracking was not active on this day. Cash vs Card sales data is still accurate.</p>
                        </div>
                    </div>
                    {role === 'admin' && (
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-none font-bold text-slate-600 border-slate-300"
                            onClick={() => setIsBackdateDialogOpen(true)}
                        >
                            Backdate Shift
                        </Button>
                    )}
                </div>
            )}

            {/* Historical: Closed Shift Banner */}
            {!isToday && selectedDateShift && (
                <div className={`rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between border gap-4 ${
                    (selectedDateShift.variance ?? 0) === 0 && (selectedDateShift.cardVariance ?? 0) === 0 ? 'bg-emerald-50 border-emerald-200' :
                    (selectedDateShift.variance ?? 0) < 0 || (selectedDateShift.cardVariance ?? 0) < 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                }`}>
                    <div>
                        <p className="text-sm font-black text-slate-700">
                            Shift: {new Date(selectedDateShift.startTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} → {selectedDateShift.endTime ? new Date(selectedDateShift.endTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Not closed'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                            Float: Nrs. {selectedDateShift.startingCash.toLocaleString()} • By: {selectedDateShift.cashierName}
                            {role === 'admin' && (
                                <button 
                                    onClick={() => {
                                        setEditStartingCash(String(selectedDateShift.startingCash));
                                        setEditClosingCash(String(selectedDateShift.actualClosingCash ?? 0));
                                        setEditClosingCard(String(selectedDateShift.actualClosingCard ?? 0));
                                        setIsEditDialogOpen(true);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 underline font-bold px-2 ml-1"
                                >
                                    Edit
                                </button>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedDateShift.variance !== null && (
                            <Badge className={`font-black ${
                                selectedDateShift.variance === 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                selectedDateShift.variance < 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                            }`}>
                                Cash Var: {selectedDateShift.variance > 0 ? '+' : ''}{selectedDateShift.variance.toLocaleString()}
                            </Badge>
                        )}
                        {selectedDateShift.cardVariance !== null && (
                            <Badge className={`font-black ${
                                selectedDateShift.cardVariance === 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                selectedDateShift.cardVariance < 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                            }`}>
                                Card Var: {selectedDateShift.cardVariance > 0 ? '+' : ''}{selectedDateShift.cardVariance.toLocaleString()}
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Cash In */}
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border group">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        <Banknote className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Cash Intake</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1 font-['DM_Sans',sans-serif] tracking-tight">Rs. {financials.cashIn.toLocaleString()}</p>
                </div>

                {/* Card In */}
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border group">
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Interbank</p>
                    <p className="text-2xl font-black text-blue-600 mt-1 font-['DM_Sans',sans-serif] tracking-tight">Rs. {financials.cardIn.toLocaleString()}</p>
                </div>

                {/* Cash Expenses */}
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border group">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        <MinusCircle className="w-5 h-5 text-rose-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Outgoings</p>
                    <p className="text-2xl font-black text-rose-600 mt-1 font-['DM_Sans',sans-serif] tracking-tight">Rs. {financials.cashExpenses.toLocaleString()}</p>
                </div>

                {/* Net Revenue */}
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border group">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Gross Liquidity</p>
                    <p className="text-2xl font-black text-purple-600 mt-1 font-['DM_Sans',sans-serif] tracking-tight">Rs. {financials.totalRevenue.toLocaleString()}</p>
                </div>
            </div>

            {/* Transaction Feed - TOP SECTION */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-xl mb-8">
                <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 font-['DM_Sans',sans-serif]">
                        <Receipt className="w-4 h-4 text-slate-500" />
                        Live Transaction Stream
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
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'sale' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {t.type === 'sale' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{t.description}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {t.cashierName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase px-3 py-0.5 border-slate-200 text-slate-500">{t.method}</Badge>
                                        <span className={`text-sm font-bold tabular-nums ${t.type === 'sale' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {t.type === 'sale' ? '+' : '−'}Rs. {t.amount.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Cash Flow Summary */}
            <Card className="border border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-xl">
                <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2 font-['DM_Sans',sans-serif]">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-indigo-600" />
                        </div>
                        Cash Flow Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold font-['DM_Sans',sans-serif]">
                                    <th className="text-left py-4 px-6">Metric</th>
                                    <th className="text-right py-4 px-6">💵 Cash</th>
                                    <th className="text-right py-4 px-6">💳 Card</th>
                                    <th className="text-right py-4 px-6">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-['DM_Sans',sans-serif]">
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-6 font-bold text-emerald-700 flex items-center gap-2">
                                        <ArrowUpRight className="w-4 h-4" /> Sales In
                                    </td>
                                    <td className="py-4 px-6 text-right font-bold text-emerald-600">+{financials.cashIn.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-bold text-emerald-600">+{financials.cardIn.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-black text-emerald-700">+{financials.totalRevenue.toLocaleString()}</td>
                                </tr>
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-6 font-bold text-red-600 flex items-center gap-2">
                                        <ArrowDownRight className="w-4 h-4" /> Expenses Out
                                    </td>
                                    <td className="py-4 px-6 text-right font-bold text-red-500">-{financials.cashExpenses.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-bold text-red-500">-{financials.cardExpenses.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right font-black text-red-600">-{financials.totalExpenses.toLocaleString()}</td>
                                </tr>
                                <tr className="bg-indigo-50/30">
                                    <td className="py-4 px-6 text-slate-800 font-black">Net Flow</td>
                                    <td className="py-4 px-6 text-right text-slate-800 font-bold">{financials.netCash.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right text-slate-800 font-bold">{financials.netCard.toLocaleString()}</td>
                                    <td className="py-4 px-6 text-right text-indigo-900 font-black text-base">{(financials.netCash + financials.netCard).toLocaleString()}</td>
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
                            <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-widest">Formal audit ledger for all recorded sessions</p>
                        </div>
                        
                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input 
                                    placeholder="Search Cashier..." 
                                    className="h-9 w-[180px] pl-9 text-xs border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500"
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
                                                ? 'bg-white text-indigo-600 shadow-sm font-black' 
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
                                    <th className="py-4 px-6 text-left font-bold">Session Date</th>
                                    <th className="py-4 px-6 text-left font-bold">Cashier / Staff</th>
                                    <th className="py-4 px-6 text-right font-bold">Expected (Cash/Card)</th>
                                    <th className="py-4 px-6 text-right font-bold">Actual Collected</th>
                                    <th className="py-4 px-6 text-right font-bold">Variance</th>
                                    <th className="py-4 px-6 text-center font-bold">Audit Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium italic">
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
                                            <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-slate-900">{new Date(s.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                    <div className="text-[9px] text-slate-400 font-medium uppercase mt-0.5 tracking-tight">
                                                        {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {s.endTime && ` — ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                        <span className="font-semibold text-slate-700">{s.cashierName}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-right text-slate-500 font-medium leading-relaxed">
                                                    <div>Cash: Rs. {s.expectedClosingCash?.toLocaleString()}</div>
                                                    <div>Card: Rs. {s.expectedClosingCard?.toLocaleString()}</div>
                                                </td>
                                                <td className="py-4 px-6 text-right font-bold text-slate-900 tabular-nums">
                                                    Rs. {((s.actualClosingCash ?? 0) + (s.actualClosingCard ?? 0)).toLocaleString()}
                                                </td>
                                                <td className={`py-4 px-6 text-right font-black tabular-nums ${
                                                    isPerfect ? 'text-emerald-600' : isShort ? 'text-rose-600' : 'text-blue-600'
                                                }`}>
                                                    {totalVariance > 0 ? '+' : ''}{totalVariance.toLocaleString()}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <span className={`inline-flex px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                        isPerfect ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                                    }`}>
                                                        {isPerfect ? 'Balanced' : 'Variance'}
                                                    </span>
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
                            Showing {filteredShifts.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0}-{Math.min(filteredShifts.length, currentPage * rowsPerPage)} of {filteredShifts.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 text-[10px] font-black uppercase border-slate-200 disabled:opacity-50"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                                            currentPage === i + 1 
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                                                : 'text-slate-400 hover:bg-slate-100'
                                        }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 text-[10px] font-black uppercase border-slate-200 disabled:opacity-50"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            <PlayCircle className="w-5 h-5 text-emerald-600" />
                            Start Your Day
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-slate-500">
                            Count the physical cash in the drawer right now and enter the exact amount below.
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
                        <Button
                            onClick={() => openShiftMutation.mutate(parseFloat(startingCashInput) || 0)}
                            disabled={!startingCashInput || openShiftMutation.isPending}
                            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm"
                        >
                            {openShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Open Drawer
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            <StopCircle className="w-5 h-5 text-red-500" />
                            Close Your Day
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        {/* Summary Section */}
                        <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cash Reconciliation</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Expected in Drawer</span>
                                    <span className="font-black text-slate-800">Nrs. {financials.expectedDrawer.toLocaleString()}</span>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Card Reconciliation</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Expected Card Total</span>
                                    <span className="font-black text-slate-800">Nrs. {financials.expectedCardTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Actual Cash (Nrs.)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={closingCashInput}
                                    onChange={(e) => setClosingCashInput(e.target.value)}
                                    placeholder="Count cash"
                                    className="h-12 text-lg font-black text-center"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Actual Card (Nrs.)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={closingCardInput}
                                    onChange={(e) => setClosingCardInput(e.target.value)}
                                    placeholder="Slip total"
                                    className="h-12 text-lg font-black text-center"
                                />
                            </div>
                        </div>

                        {/* Variances */}
                        {(closingCashInput || closingCardInput) && (
                            <div className="space-y-2">
                                {closingCashInput && (
                                    <div className={`p-2.5 rounded-xl border text-center ${
                                        parseFloat(closingCashInput) === financials.expectedDrawer ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                        <p className="text-[11px] font-black text-slate-700">
                                            Cash Variance: {parseFloat(closingCashInput) - financials.expectedDrawer === 0 ? '✅ Perfect' : `${parseFloat(closingCashInput) - financials.expectedDrawer > 0 ? '+' : ''}${(parseFloat(closingCashInput) - financials.expectedDrawer).toLocaleString()}`}
                                        </p>
                                    </div>
                                )}
                                {closingCardInput && (
                                    <div className={`p-2.5 rounded-xl border text-center ${
                                        parseFloat(closingCardInput) === financials.expectedCardTotal ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                        <p className="text-[11px] font-black text-slate-700">
                                            Card Variance: {parseFloat(closingCardInput) - financials.expectedCardTotal === 0 ? '✅ Perfect' : `${parseFloat(closingCardInput) - financials.expectedCardTotal > 0 ? '+' : ''}${(parseFloat(closingCardInput) - financials.expectedCardTotal).toLocaleString()}`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button
                            onClick={() => closeShiftMutation.mutate({ 
                                actualCash: parseFloat(closingCashInput) || 0, 
                                actualCard: parseFloat(closingCardInput) || 0 
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

            {/* Backdate Dialog */}
            <Dialog open={isBackdateDialogOpen} onOpenChange={setIsBackdateDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black">
                            Backdate Historical Shift
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-slate-500">
                            Create a missing shift record for <strong>{new Date(selectedDate).toLocaleDateString()}</strong>.
                        </p>
                        <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Calculated Cash In</span>
                                <span className="font-bold text-emerald-600">+{financials.cashIn.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Calculated Cash Out</span>
                                <span className="font-bold text-orange-600">-{financials.cashExpenses.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 border-t pt-1 mt-1">
                                <span>Net Difference</span>
                                <span>{financials.netCash > 0 ? '+' : ''}{financials.netCash.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Starting Cash (Float)</label>
                                <Input
                                    type="number"
                                    value={backdateStartingCash}
                                    onChange={(e) => setBackdateStartingCash(e.target.value)}
                                    placeholder="Enter opening amount"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Actual Cash</label>
                                    <Input
                                        type="number"
                                        value={backdateClosingCash}
                                        onChange={(e) => setBackdateClosingCash(e.target.value)}
                                        placeholder="Enter final count"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Actual Card</label>
                                    <Input
                                        type="number"
                                        value={backdateClosingCard}
                                        onChange={(e) => setBackdateClosingCard(e.target.value)}
                                        placeholder="Enter final total"
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={() => addHistoricalShiftMutation.mutate()}
                            disabled={!backdateStartingCash || !backdateClosingCash || !backdateClosingCard || addHistoricalShiftMutation.isPending}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm relative overflow-hidden"
                        >
                            {addHistoricalShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin relative z-10" />}
                            <span className="relative z-10">Save Backdated Shift</span>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-indigo-700">
                            Edit Shift Record
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-slate-500">
                            <strong>Admin Only:</strong> Correct a typo in the shift values. This will permanently update the variance.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Corrected Starting Cash</label>
                                <Input
                                    type="number"
                                    value={editStartingCash}
                                    onChange={(e) => setEditStartingCash(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Actual Cash</label>
                                    <Input
                                        type="number"
                                        value={editClosingCash}
                                        onChange={(e) => setEditClosingCash(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Actual Card</label>
                                    <Input
                                        type="number"
                                        value={editClosingCard}
                                        onChange={(e) => setEditClosingCard(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={() => editShiftMutation.mutate()}
                            disabled={!editStartingCash || !editClosingCash || !editClosingCard || editShiftMutation.isPending}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm relative overflow-hidden"
                        >
                            {editShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin relative z-10" />}
                            <span className="relative z-10">Update Shift Record</span>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
