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
    MinusCircle,
    Search,
    BookOpen,
    Download,
    FileText,
    History,
    Edit2,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Shift {
    id: number;
    cashierId: string;
    cashierName: string;
    startTime: string;
    endTime: string | null;
    startingCash: number;
    startingcard?: number;
    expectedClosingCash: number | null;
    actualClosingCash: number | null;
    variance: number | null;
    expectedclosingcard: number | null;
    actualclosingcard: number | null;
    cardvariance: number | null;
    status: string;
    portal: string;
    notes?: string;
    closedBy?: string;
    closedByName?: string;
}

interface SupplierPayment {
    id: string;
    amount: number;
    payment_method: string;
    fund_source?: string;
    date: string;
    suppliers?: {
        name: string;
    };
}

interface TransactionItem {
    id: string;
    type: 'sale' | 'expense';
    description: string;
    method: string;
    time: Date;
    cashierName?: string;
    cashIn: number;
    cashOut: number;
    cashBalance: number;
    digitalIn: number;
    digitalOut: number;
    digitalBalance: number;
}

export function ShiftLedgerPage() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
    const [isBackdateDialogOpen, setIsBackdateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [startingCashInput, setStartingCashInput] = useState('');
    const [startingcardInput, setStartingCardInput] = useState('');
    const [closingCashInput, setClosingCashInput] = useState('');
    const [closingCardInput, setClosingCardInput] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [backdateStartingCash, setBackdateStartingCash] = useState('');
    const [backdateStartingCard, setBackdateStartingCard] = useState('');
    const [backdateClosingCash, setBackdateClosingCash] = useState('');
    const [backdateClosingCard, setBackdateClosingCard] = useState('');
    const [editStartingCash, setEditStartingCash] = useState('');
    const [editStartingCard, setEditStartingCard] = useState('');
    const [editClosingCash, setEditClosingCash] = useState('');
    const [editClosingCard, setEditClosingCard] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [shiftToDelete, setShiftToDelete] = useState<number | null>(null);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    });

    // Shift Audit Ledger State
    const [shiftSearch, setShiftSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'balanced' | 'variance'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage] = useState(10);
    
    // Consolidated Ledger Feed State
    const [ledgerFilter, setLedgerFilter] = useState<'all' | 'sale' | 'expense'>('all');
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [backdateDate, setBackdateDate] = useState(selectedDate);

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
        let drawerCashExpenses = 0;
        let safeCashExpenses = 0;
        let cardExpenses = 0;
        let totalOrders = 0;
        let totalExpenseCount = 0;

        if (!orders || !expenses || !supplierPayments) {
            return {
                cashIn: 0, cardIn: 0, cashExpenses: 0, cardExpenses: 0,
                drawerCashExpenses: 0, safeCashExpenses: 0,
                netCash: 0, netCard: 0, totalRevenue: 0, totalExpenses: 0,
                expectedDrawer: 0, expectedCardTotal: 0, hasShiftData: false,
                totalOrders: 0, totalExpenseCount: 0
            };
        }

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
            const fundSource = (e.fund_source as string || 'drawer').toLowerCase();
            if (method === 'cash') {
                if (fundSource === 'safe') {
                    safeCashExpenses += amount;
                } else {
                    drawerCashExpenses += amount;
                }
            } else if (method === 'card') {
                if (fundSource !== 'external') {
                    cardExpenses += amount;
                }
            }
        });

        supplierPayments.forEach((sp: SupplierPayment) => {
            const method = (sp.payment_method as string || '').toLowerCase();
            const amount = Number(sp.amount) || 0;
            const fundSource = (sp.fund_source as string || 'drawer').toLowerCase();
            if (method === 'cash') {
                if (fundSource === 'safe') {
                    safeCashExpenses += amount;
                } else {
                    drawerCashExpenses += amount;
                }
            } else if (method === 'card') {
                if (fundSource !== 'external') {
                    cardExpenses += amount;
                }
            }
        });

        const totalCashExpenses = drawerCashExpenses + safeCashExpenses;
        const netCash = cashIn - drawerCashExpenses; // Safe expenses do not affect drawer
        const netCard = cardIn - cardExpenses;
        // Use selectedDateShift for historical, activeShift for today
        const shiftForCalc = isToday ? activeShift : selectedDateShift;
        const expectedDrawer = (shiftForCalc?.startingCash || 0) + netCash;
        const expectedCardTotal = (shiftForCalc?.startingcard || 0) + netCard;
        const hasShiftData = !!shiftForCalc;

        return {
            cashIn, cardIn, cashExpenses: totalCashExpenses, cardExpenses,
            drawerCashExpenses, safeCashExpenses,
            netCash, netCard,
            totalRevenue: cashIn + cardIn,
            totalExpenses: totalCashExpenses + cardExpenses,
            expectedDrawer,
            expectedCardTotal,
            hasShiftData,
            totalOrders,
            totalExpenseCount
        };
    }, [orders, expenses, supplierPayments, activeShift, selectedDateShift, isToday]);

    // ── Backdate Financials (Decoupled & Hardened) ──
    const { data: bOrders = [] } = useQuery({
        queryKey: ['backdate-orders', backdateDate],
        enabled: isBackdateDialogOpen,
        queryFn: async () => {
            if (!backdateDate || backdateDate.length < 10) return [];
            const start = new Date(backdateDate);
            if (isNaN(start.getTime())) return [];
            start.setHours(0, 0, 0, 0);
            const end = new Date(backdateDate);
            end.setHours(23, 59, 59, 999);
            const { data } = await supabase.from('orders').select('*').gte('createdAt', start.toISOString()).lte('createdAt', end.toISOString()).eq('status', 'completed');
            return data || [];
        }
    });

    const { data: bExpenses = [] } = useQuery({
        queryKey: ['backdate-expenses', backdateDate],
        enabled: isBackdateDialogOpen,
        queryFn: async () => {
            if (!backdateDate || backdateDate.length < 10) return [];
            const start = new Date(backdateDate);
            if (isNaN(start.getTime())) return [];
            start.setHours(0, 0, 0, 0);
            const end = new Date(backdateDate);
            end.setHours(23, 59, 59, 999);
            const { data } = await supabase.from('expenses').select('*').eq('portal', 'retail').gte('date', start.toISOString()).lte('date', end.toISOString());
            return data || [];
        }
    });

    const { data: bSuppliers = [] } = useQuery({
        queryKey: ['backdate-suppliers', backdateDate],
        enabled: isBackdateDialogOpen,
        queryFn: async () => {
            if (!backdateDate || backdateDate.length < 10) return [];
            const start = new Date(backdateDate);
            if (isNaN(start.getTime())) return [];
            start.setHours(0, 0, 0, 0);
            const end = new Date(backdateDate);
            end.setHours(23, 59, 59, 999);
            const { data } = await supabase.from('supplier_transactions').select('*, suppliers!inner(name, portal)').eq('suppliers.portal', 'retail').eq('type', 'PAYMENT').eq('is_deleted', false).gte('date', start.toISOString()).lte('date', end.toISOString());
            return data || [];
        }
    });

    const backdateFinancials = useMemo(() => {
        let bin = 0, bout = 0;
        bOrders.forEach((o: any) => {
            if (o.isWaste) return;
            const method = (o.paymentMethod || '').toLowerCase();
            const total = Number(o.totalAmount) || 0;
            const cash = Number(o.cashAmount) || 0;
            if (method === 'cash') bin += total;
            else if (method === 'split') bin += cash;
        });
        bExpenses.forEach((e: any) => {
            if ((e.payment_method || '').toLowerCase() === 'cash' && (e.fund_source || 'drawer').toLowerCase() !== 'safe') bout += Number(e.amount) || 0;
        });
        bSuppliers.forEach((s: any) => {
            if ((s.payment_method || '').toLowerCase() === 'cash' && (s.fund_source || 'drawer').toLowerCase() !== 'safe') bout += Number(s.amount) || 0;
        });
        return { cashIn: bin, cashExpenses: bout, netCash: bin - bout };
    }, [bOrders, bExpenses, bSuppliers]);

    // ── Consolidated EOD Ledger Feed ──
    const transactions = useMemo<TransactionItem[]>(() => {
        let salesCashIn = 0;
        let salesDigitalIn = 0;
        
        orders.forEach((o: Record<string, unknown>) => {
            if (o.isWaste) return;
            const method = String(o.paymentMethod || 'Cash').toLowerCase();
            const total = Number(o.totalAmount) || 0;
            const cash = Number(o.cashAmount) || 0;
            const card = Number(o.cardAmount) || 0;
            
            if (method === 'cash') salesCashIn += total;
            else if (method === 'card') salesDigitalIn += total;
            else if (method === 'split') {
                salesCashIn += cash;
                salesDigitalIn += card;
            }
        });

        let expCashOut = 0;
        let expDigitalOut = 0;

        expenses.forEach((e: Record<string, unknown>) => {
            const method = String(e.payment_method || 'Cash').toLowerCase();
            const fundSource = String(e.fund_source || 'drawer').toLowerCase();
            const amount = Number(e.amount) || 0;
            
            if (method === 'cash' && fundSource !== 'safe') expCashOut += amount;
            else if (method === 'card' && fundSource !== 'external') expDigitalOut += amount;
        });

        // Group supplier payments by supplier name
        const supplierAggregates: Record<string, { cashOut: number, digitalOut: number }> = {};

        supplierPayments.forEach((sp: SupplierPayment) => {
            const method = String(sp.payment_method || 'Cash').toLowerCase();
            const fundSource = String(sp.fund_source || 'drawer').toLowerCase();
            const amount = Number(sp.amount) || 0;
            const supplierName = sp.suppliers?.name || 'Unknown Supplier';
            
            if (!supplierAggregates[supplierName]) {
                supplierAggregates[supplierName] = { cashOut: 0, digitalOut: 0 };
            }

            if (method === 'cash' && fundSource !== 'safe') {
                supplierAggregates[supplierName].cashOut += amount;
            } else if (method === 'card' && fundSource !== 'external') {
                supplierAggregates[supplierName].digitalOut += amount;
            }
        });

        const shiftForCalc = isToday ? activeShift : selectedDateShift;
        const startCash = shiftForCalc?.startingCash || 0;
        const startDigital = shiftForCalc?.startingcard || 0;
        
        const ledgerDate = new Date(selectedDate);
        const items: TransactionItem[] = [];

        // 1. Aggregate Sales
        if (salesCashIn > 0 || salesDigitalIn > 0) {
            items.push({
                id: 'eod_sales',
                type: 'sale',
                description: 'End of Day: Total POS Sales',
                method: 'Mixed',
                time: ledgerDate,
                cashierName: 'System',
                cashIn: salesCashIn,
                cashOut: 0,
                cashBalance: startCash + salesCashIn,
                digitalIn: salesDigitalIn,
                digitalOut: 0,
                digitalBalance: startDigital + salesDigitalIn
            });
        }

        // 2. Itemized Expenses
        expenses.forEach((e: any) => {
            const method = String(e.payment_method || 'Cash').toLowerCase();
            const fundSource = String(e.fund_source || 'drawer').toLowerCase();
            const amount = Number(e.amount) || 0;
            const isCash = method === 'cash' && fundSource !== 'safe';
            const isDigital = method === 'card' && fundSource !== 'external';

            if (isCash || isDigital) {
                const currentCash = items.length > 0 ? items[items.length - 1].cashBalance : startCash;
                const currentDigital = items.length > 0 ? items[items.length - 1].digitalBalance : startDigital;
                
                items.push({
                    id: `eod_exp_${e.id}`,
                    type: 'expense',
                    description: `Expense: ${e.description || 'Misc'}`,
                    method: e.payment_method || 'Cash',
                    time: new Date(e.date || ledgerDate),
                    cashierName: e.recorded_by_name || 'Staff',
                    cashIn: 0,
                    cashOut: isCash ? amount : 0,
                    cashBalance: isCash ? currentCash - amount : currentCash,
                    digitalIn: 0,
                    digitalOut: isDigital ? amount : 0,
                    digitalBalance: isDigital ? currentDigital - amount : currentDigital
                });
            }
        });

        // 3. Aggregate Supplier Payments (Per Supplier)
        Object.entries(supplierAggregates).forEach(([supplierName, totals]) => {
            if (totals.cashOut > 0 || totals.digitalOut > 0) {
                const currentCash = items.length > 0 ? items[items.length - 1].cashBalance : startCash;
                const currentDigital = items.length > 0 ? items[items.length - 1].digitalBalance : startDigital;
                items.push({
                    id: `eod_sp_${supplierName.replace(/\s+/g, '_')}`,
                    type: 'expense',
                    description: `Client Payout: ${supplierName}`,
                    method: 'Mixed',
                    time: ledgerDate,
                    cashierName: 'System',
                    cashIn: 0,
                    cashOut: totals.cashOut,
                    cashBalance: currentCash - totals.cashOut,
                    digitalIn: 0,
                    digitalOut: totals.digitalOut,
                    digitalBalance: currentDigital - totals.digitalOut
                });
            }
        });

        return items;
    }, [orders, expenses, supplierPayments, activeShift, selectedDateShift, isToday]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesFilter = ledgerFilter === 'all' || t.type === ledgerFilter;
            const matchesSearch = t.description.toLowerCase().includes(ledgerSearch.toLowerCase()) || 
                                  (t.cashierName && t.cashierName.toLowerCase().includes(ledgerSearch.toLowerCase()));
            return matchesFilter && matchesSearch;
        });
    }, [transactions, ledgerFilter, ledgerSearch]);

    const exportLedgerCSV = () => {
        const headers = ['Date', 'Type', 'Description', 'Method', 'Cash In', 'Cash Out', 'Cash Balance', 'Online In', 'Online Out', 'Online Balance', 'Cashier'];
        const csvContent = [
            headers.join(','),
            ...filteredTransactions.map(t => [
                t.time.toLocaleDateString(),
                t.type,
                `"${t.description.replace(/"/g, '""')}"`,
                t.method,
                t.cashIn,
                t.cashOut,
                t.cashBalance,
                t.digitalIn,
                t.digitalOut,
                t.digitalBalance,
                `"${t.cashierName || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Coko_Daily_Ledger_${selectedDate}.csv`;
        link.click();
        toast.success('CSV Exported Successfully');
    };

    const exportLedgerPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Coko Daily Ledger - ${selectedDate}`, 14, 15);
        
        const tableColumn = ["Date", "Description", "Cash In", "Cash Out", "Cash Bal", "Online In", "Online Out", "Online Bal"];
        const tableRows = filteredTransactions.map(t => [
            t.time.toLocaleDateString(),
            t.description.length > 25 ? t.description.substring(0, 25) + '...' : t.description,
            t.cashIn > 0 ? t.cashIn : '-',
            t.cashOut > 0 ? t.cashOut : '-',
            t.cashBalance,
            t.digitalIn > 0 ? t.digitalIn : '-',
            t.digitalOut > 0 ? t.digitalOut : '-',
            t.digitalBalance
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 'auto' },
                2: { halign: 'right', cellWidth: 20 },
                3: { halign: 'right', cellWidth: 20 },
                4: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
                5: { halign: 'right', cellWidth: 20 },
                6: { halign: 'right', cellWidth: 20 },
                7: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
            }
        });

        doc.save(`Coko_Daily_Ledger_${selectedDate}.pdf`);
        toast.success('PDF Exported Successfully');
    };

    // ── Filtered & Paginated Shift History ──
    const filteredShifts = useMemo(() => {
        return shiftHistory.filter(s => {
            const matchesSearch = s.cashierName.toLowerCase().includes(shiftSearch.toLowerCase());
            const totalVariance = (s.variance ?? 0) + (s.cardvariance ?? 0);
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
                startingcard: payload.card,
                status: 'open',
                portal: 'retail',
                user_id: user?.id
            });
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['active-shift'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            const cashVal = variables.cash;
            setIsStartDialogOpen(false);
            setStartingCashInput('');
            toast.success('Day Started', { description: `Drawer opened with Nrs. ${cashVal}` });
            api.logActivity({
                action: 'SHIFT_OPENED',
                category: 'POS',
                description: `Shift opened with Nrs. ${cashVal} starting cash.`,
                metadata: { startingCash: cashVal },
                actor_email: user?.email || 'system',
                actor_name: user?.email?.split('@')[0] || 'System',
            });
        },
        onError: (err: Error) => toast.error('Failed to open shift', { description: err.message })
    });

    // ── Shift Ownership Check ──
    const isShiftOwner = activeShift?.cashierId === user?.email;
    const isAdmin = role === 'admin';
    const canCloseShift = isShiftOwner || isAdmin;

    const closeShiftMutation = useMutation({
        mutationFn: async (payload: { actualCash: number, actualCard: number, notes?: string }) => {
            if (!activeShift) throw new Error('No active shift');
            if (!canCloseShift) throw new Error('Only the shift owner or an admin can close this shift.');
            
            const variance = payload.actualCash - financials.expectedDrawer;
            const cardvariance = payload.actualCard - financials.expectedCardTotal;
            
            // Professional Schema-Aware Fallback Strategy
            // 1. Attempt Full Professional Update (Includes Card, Notes, Auditor info)
            const fullPayload = {
                endTime: new Date().toISOString(),
                expectedClosingCash: financials.expectedDrawer,
                actualClosingCash: payload.actualCash,
                variance: variance,
                expectedclosingcard: financials.expectedCardTotal,
                actualclosingcard: payload.actualCard,
                cardvariance: cardvariance,
                status: 'closed',
                notes: payload.notes,
                closedBy: user?.email || 'unknown',
                closedByName: user?.email?.split('@')[0] || 'Unknown'
            };

            const { error: fullError } = await supabase
                .from('shifts')
                .update(fullPayload)
                .eq('id', activeShift.id);

            if (fullError) {
                console.warn('Full shift closure failed (likely schema mismatch), attempting core fallback:', fullError.message);
                
                // 2. Fallback to Standard DB Schema (Guaranteed by supabase_schema.sql)
                const fallbackPayload = {
                    "endTime": new Date().toISOString(),
                    "expectedClosingCash": financials.expectedDrawer,
                    "actualClosingCash": payload.actualCash,
                    "variance": variance,
                    "status": 'closed'
                };

                const { error: fallbackError } = await supabase
                    .from('shifts')
                    .update(fallbackPayload)
                    .eq('id', activeShift.id);

                if (fallbackError) throw fallbackError;
                
                toast.info('Shift closed with core data', { 
                    description: 'Advanced audit fields (Card/Notes) skipped due to server-side schema limitations.' 
                });
            }

            return { variance, cardvariance };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['active-shift-retail'] });
            queryClient.invalidateQueries({ queryKey: ['shift-history-retail'] });
            setIsCloseDialogOpen(false);
            setClosingCashInput('');
            setClosingCardInput('');
            setClosingNotes('');
            
            // Log to Audit Trail
            api.logActivity({
                action: 'SHIFT_CLOSED',
                category: 'POS',
                description: `Shift closed. Variance: Nrs. ${data.variance}`,
                metadata: { 
                    shiftId: activeShift?.id,
                    variance: data.variance,
                    cardvariance: data.cardvariance
                },
                actor_email: user?.email || 'system',
                actor_name: user?.email?.split('@')[0] || 'System',
            });

            toast.success('Register Closed Successfully', {
                description: `Daily records locked. Cash Variance: Nrs. ${data.variance}`
            });
        },
        onError: (err: Error) => {
            console.error('Register Closure Error:', err);
            toast.error('Failed to Close Register', { description: err.message });
        }
    });

    // ── Backdate Shift Mutation (Historical) ──
    const addHistoricalShiftMutation = useMutation({
        mutationFn: async () => {
            const start = parseFloat(backdateStartingCash) || 0;
            const startCard = parseFloat(backdateStartingCard) || 0;
            const actual = parseFloat(backdateClosingCash) || 0;
            const actualCard = parseFloat(backdateClosingCard) || 0;
            const expected = start + backdateFinancials.netCash;
            const expectedCard = startCard + 0; // We don't have bNetCard yet but can add it if needed
            const variance = actual - expected;
            const cardvariance = actualCard - expectedCard;

            const shiftStart = new Date(backdateDate);
            shiftStart.setHours(9, 0, 0, 0);
            const shiftEnd = new Date(backdateDate);
            shiftEnd.setHours(21, 0, 0, 0);

            const { error } = await supabase.from('shifts').insert({
                cashierId: user?.email || 'unknown',
                cashierName: user?.email?.split('@')[0] || 'Unknown',
                startTime: shiftStart.toISOString(),
                endTime: shiftEnd.toISOString(),
                startingCash: start,
                startingcard: startCard,
                expectedClosingCash: expected,
                actualClosingCash: actual,
                variance,
                expectedclosingcard: expectedCard,
                actualclosingcard: actualCard,
                cardvariance,
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
            const startCard = parseFloat(editStartingCard) || 0;
            const actual = parseFloat(editClosingCash) || 0;
            const actualCard = parseFloat(editClosingCard) || 0;
            const expected = start + financials.netCash;
            const expectedCard = startCard + financials.netCard;
            const variance = actual - expected;
            const cardvariance = actualCard - expectedCard;

            const { error } = await supabase
                .from('shifts')
                .update({
                    startingCash: start,
                    startingcard: startCard,
                    expectedClosingCash: expected,
                    actualClosingCash: actual,
                    variance,
                    expectedclosingcard: expectedCard,
                    actualclosingcard: actualCard,
                    cardvariance,
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

    const deleteShiftMutation = useMutation({
        mutationFn: async (id: number) => {
            const { error } = await supabase.from('shifts').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            queryClient.invalidateQueries({ queryKey: ['shift-for-date'] });
            queryClient.invalidateQueries({ queryKey: ['active-shift'] });
            setIsDeleteDialogOpen(false);
            setShiftToDelete(null);
            toast.success('Shift Permanently Deleted');
        },
        onError: (err: Error) => toast.error('Failed to delete', { description: err.message })
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
                        Shift <span className="text-emerald-600">Ledger</span>
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
                    {isAdmin && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setBackdateDate(selectedDate);
                                setIsBackdateDialogOpen(true);
                            }}
                            className="h-[44px] px-6 rounded-full border-slate-200 text-slate-600 hover:bg-slate-50 font-black text-[10px] uppercase tracking-widest transition-all shadow-sm"
                        >
                            <History className="w-4 h-4 mr-2" />
                            Backdate
                        </Button>
                    )}
                    {isToday && !activeShift && (
                        <Button
                            onClick={() => setIsStartDialogOpen(true)}
                            className="h-[44px] px-8 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-xl hover:shadow-emerald-500/20 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Initialize Shift
                        </Button>
                    )}
                    {isToday && activeShift && canCloseShift && (
                        <Button
                            onClick={() => setIsCloseDialogOpen(true)}
                            className="h-[44px] px-8 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-[10px] uppercase tracking-widest transition-all shadow-sm"
                        >
                            <StopCircle className="w-4 h-4 mr-2" />
                            Terminate Day
                        </Button>
                    )}
                    {isToday && activeShift && !canCloseShift && (
                        <div className="h-[44px] px-6 rounded-full bg-slate-100 border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 cursor-not-allowed">
                            <StopCircle className="w-4 h-4" />
                            Admin Only
                        </div>
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
                            <p className="text-[11px] text-emerald-600 font-medium">Float: Rs. {activeShift.startingCash.toLocaleString()} • Opened by: {activeShift.cashierName} ({activeShift.cashierId})</p>
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
                    (selectedDateShift.variance ?? 0) === 0 && (selectedDateShift.cardvariance ?? 0) === 0 ? 'bg-emerald-50 border-emerald-200' :
                    (selectedDateShift.variance ?? 0) < 0 || (selectedDateShift.cardvariance ?? 0) < 0 ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
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
                                        setEditClosingCard(String(selectedDateShift.actualclosingcard ?? 0));
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
                        {selectedDateShift.cardvariance !== null && (
                            <Badge className={`font-black ${
                                selectedDateShift.cardvariance === 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                selectedDateShift.cardvariance < 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                            }`}>
                                Card Var: {selectedDateShift.cardvariance > 0 ? '+' : ''}{selectedDateShift.cardvariance.toLocaleString()}
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Cash In */}
                <div className="bg-white/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 p-6 lg:p-8 shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100/50 flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500 shadow-sm border border-emerald-100">
                        <Banknote className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-['DM_Sans',sans-serif] mb-1">Cash Intake</p>
                    <p className="text-2xl lg:text-3xl font-black text-emerald-600 font-['DM_Sans',sans-serif] tracking-tighter">Rs. {financials.cashIn.toLocaleString()}</p>
                </div>

                {/* Card In */}
                <div className="bg-white/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 p-6 lg:p-8 shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
                    <div className="w-12 h-12 rounded-2xl bg-blue-100/50 flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500 shadow-sm border border-blue-100">
                        <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-['DM_Sans',sans-serif] mb-1">Digital Intake</p>
                    <p className="text-2xl lg:text-3xl font-black text-blue-600 font-['DM_Sans',sans-serif] tracking-tighter">Rs. {financials.cardIn.toLocaleString()}</p>
                </div>

                {/* Cash Expenses */}
                <div className="bg-white/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 p-6 lg:p-8 shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
                    <div className="w-12 h-12 rounded-2xl bg-rose-100/50 flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500 shadow-sm border border-rose-100">
                        <MinusCircle className="w-6 h-6 text-rose-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-['DM_Sans',sans-serif] mb-1">Cash Outgoings</p>
                    <p className="text-2xl lg:text-3xl font-black text-rose-600 font-['DM_Sans',sans-serif] tracking-tighter">Rs. {(financials?.cashExpenses || 0).toLocaleString()}</p>
                </div>

                {/* Card Expenses */}
                <div className="bg-white/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 p-6 lg:p-8 shadow-2xl hover:-translate-y-2 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700" />
                    <div className="w-12 h-12 rounded-2xl bg-purple-100/50 flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500 shadow-sm border border-purple-100">
                        <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-['DM_Sans',sans-serif] mb-1">Digital Outgoings</p>
                    <p className="text-2xl lg:text-3xl font-black text-purple-600 font-['DM_Sans',sans-serif] tracking-tighter">Rs. {(financials?.cardExpenses || 0).toLocaleString()}</p>
                </div>
            </div>

            {/* Consolidated Ledger Feed - Matches Handwritten Ledger */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-xl mb-8">
                <CardHeader className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 font-['DM_Sans',sans-serif]">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            Consolidated Daily Ledger
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] font-black uppercase px-3 py-1 bg-white text-slate-400 border-slate-200">
                            {filteredTransactions.length} Entries
                        </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <div className="relative flex-grow max-w-sm">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input 
                                placeholder="Search description..." 
                                className="h-9 pl-9 text-xs border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white w-full"
                                value={ledgerSearch}
                                onChange={(e) => setLedgerSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            {['all', 'sale', 'expense'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setLedgerFilter(filter as any)}
                                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                                        ledgerFilter === filter 
                                            ? 'bg-white text-indigo-600 shadow-sm font-black' 
                                            : 'text-slate-500 hover:text-slate-700 font-bold'
                                    }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                            <Button variant="outline" size="sm" onClick={exportLedgerCSV} className="h-9 text-xs gap-2 border-slate-200 hover:bg-slate-50">
                                <FileText className="w-3.5 h-3.5 text-blue-600" /> Export CSV
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportLedgerPDF} className="h-9 text-xs gap-2 border-slate-200 hover:bg-slate-50">
                                <Download className="w-3.5 h-3.5 text-rose-600" /> Export PDF
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-[600px] custom-scrollbar bg-slate-50/20">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-100/50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="py-4 px-6 text-left border-r border-slate-200/50">Date</th>
                                    <th className="py-4 px-6 text-left border-r border-slate-200/50">Title / Desc</th>
                                    <th className="py-4 px-4 text-right text-emerald-600 border-r border-slate-200/50">Cash In(+)</th>
                                    <th className="py-4 px-4 text-right text-rose-600 border-r border-slate-200/50">Cash Out(-)</th>
                                    <th className="py-4 px-4 text-right text-slate-800 font-bold border-r border-slate-300">Cash Blc</th>
                                    <th className="py-4 px-4 text-right text-emerald-600 border-r border-slate-200/50">Online In(+)</th>
                                    <th className="py-4 px-4 text-right text-rose-600 border-r border-slate-200/50">Online Out(-)</th>
                                    <th className="py-4 px-4 text-right text-slate-800 font-bold">Online Blc</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400 font-medium italic">No transactions match your filters.</td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-4 px-6 whitespace-nowrap text-slate-500 font-medium border-r border-slate-100/50">
                                                {t.time.toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-6 border-r border-slate-100/50">
                                                <div className="font-bold text-slate-800 line-clamp-2 max-w-[200px]">{t.description}</div>
                                                {t.cashierName && <div className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">{t.cashierName}</div>}
                                            </td>
                                            <td className="py-4 px-4 text-right font-medium text-emerald-600 border-r border-slate-100/50">
                                                {t.cashIn > 0 ? t.cashIn.toLocaleString() : '-'}
                                            </td>
                                            <td className="py-4 px-4 text-right font-medium text-rose-600 border-r border-slate-100/50">
                                                {t.cashOut > 0 ? t.cashOut.toLocaleString() : '-'}
                                            </td>
                                            <td className="py-4 px-4 text-right font-black text-slate-700 bg-slate-50/30 border-r border-slate-300/50">
                                                {t.cashBalance.toLocaleString()}
                                            </td>
                                            <td className="py-4 px-4 text-right font-medium text-emerald-600 border-r border-slate-100/50">
                                                {t.digitalIn > 0 ? t.digitalIn.toLocaleString() : '-'}
                                            </td>
                                            <td className="py-4 px-4 text-right font-medium text-rose-600 border-r border-slate-100/50">
                                                {t.digitalOut > 0 ? t.digitalOut.toLocaleString() : '-'}
                                            </td>
                                            <td className="py-4 px-4 text-right font-black text-slate-700 bg-slate-50/30">
                                                {t.digitalBalance.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
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
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <Input 
                                    placeholder="Search Cashier..." 
                                    className="h-11 w-[240px] pl-11 text-sm border-slate-200/80 rounded-xl focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white font-medium"
                                    value={shiftSearch}
                                    onChange={(e) => {
                                        setShiftSearch(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                            </div>
                            <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200/60 shadow-inner backdrop-blur-sm">
                                {['all', 'balanced', 'variance'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => {
                                            setStatusFilter(filter as 'all' | 'balanced' | 'variance');
                                            setCurrentPage(1);
                                        }}
                                        className={`px-5 py-2 text-[10px] font-black uppercase tracking-[0.15em] rounded-lg transition-all duration-300 ${
                                            statusFilter === filter 
                                                ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' 
                                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-300/30'
                                        }`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                            {role === 'admin' && (
                                <Button 
                                    onClick={() => setIsBackdateDialogOpen(true)}
                                    className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200/50 flex items-center gap-2"
                                >
                                    <History className="w-4 h-4" />
                                    Backdate Historical Entry
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                                <tr>
                                    <th className="py-5 px-8 text-left font-black">Session Period</th>
                                    <th className="py-5 px-8 text-left font-black">Cashier Identity</th>
                                    <th className="py-5 px-8 text-right font-black">System Target</th>
                                    <th className="py-5 px-8 text-right font-black">Hand-Counted</th>
                                    <th className="py-5 px-8 text-right font-black">Net Discrepancy</th>
                                    <th className="py-5 px-8 text-left font-black">Audit Remarks</th>
                                    <th className="py-5 px-8 text-center font-black">Status</th>
                                    <th className="py-5 px-8 text-center font-black">Actions</th>
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
                                        const cv = s.cardvariance ?? 0;
                                        const totalVariance = v + cv;
                                        const isPerfect = totalVariance === 0;

                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50/50 transition-all duration-300 group">
                                                <td className="py-6 px-8">
                                                    <div className="font-bold text-slate-800 text-sm tracking-tight">{new Date(s.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                    <div className="text-[10px] text-slate-400 font-black uppercase mt-1.5 tracking-[0.1em] flex items-center gap-2">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {s.endTime && ` — ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg ${isPerfect ? 'bg-emerald-100' : 'bg-rose-100'} flex items-center justify-center text-[10px] font-black text-slate-700 shadow-sm border border-white`}>
                                                                {s.cashierName.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Opened By</span>
                                                                <span className="font-bold text-slate-700 tracking-tight leading-none">{s.cashierName}</span>
                                                            </div>
                                                        </div>
                                                        {s.closedByName && s.closedByName !== s.cashierName && (
                                                            <div className="flex items-center gap-3 pl-2 border-l-2 border-slate-100 ml-3">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black uppercase text-rose-400 tracking-widest leading-none mb-1">Closed By Admin</span>
                                                                    <span className="font-bold text-slate-600 text-xs tracking-tight leading-none">{s.closedByName}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {s.notes && (
                                                            <div className="mt-2 pl-3 border-l-2 border-emerald-100 italic text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                                                "{s.notes}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8 text-right">
                                                    <div className="flex flex-col gap-1.5 font-medium">
                                                        <div className="flex items-center justify-end gap-2 text-slate-700">
                                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Cash</span>
                                                            <span className="tabular-nums">{(s.expectedClosingCash ?? 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center justify-end gap-2 text-slate-500">
                                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Card</span>
                                                            <span className="tabular-nums text-[11px]">{(s.expectedclosingcard ?? 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8 text-right">
                                                    <div className="flex flex-col gap-1.5 font-black">
                                                        <div className="flex items-center justify-end gap-2 text-slate-900">
                                                            <span className="tabular-nums">{(s.actualClosingCash ?? 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center justify-end gap-2 text-slate-600">
                                                            <span className="tabular-nums text-[11px]">{(s.actualclosingcard ?? 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8 text-right font-black tabular-nums text-sm">
                                                    <div className="flex flex-col items-end gap-1.5">
                                                        {v === 0 ? (
                                                            <div className="text-emerald-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                                                Balanced
                                                            </div>
                                                        ) : (
                                                            <div className={`flex items-center gap-1 ${v < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">C:</span>
                                                                {v > 0 ? '+' : ''}{v.toLocaleString()}
                                                            </div>
                                                        )}
                                                        {cv === 0 ? (
                                                            <div className="text-emerald-400/70 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                                                Balanced
                                                            </div>
                                                        ) : (
                                                            <div className={`flex items-center gap-1 text-[11px] ${cv < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                                                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Card:</span>
                                                                {cv > 0 ? '+' : ''}{cv.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8">
                                                    <div className="max-w-[150px] truncate text-[10px] font-medium text-slate-500 italic" title={s.notes || ''}>
                                                        {s.notes || '—'}
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {role === 'admin' && (
                                                            <button 
                                                                onClick={() => {
                                                                    setShiftToDelete(s.id);
                                                                    setIsDeleteDialogOpen(true);
                                                                }}
                                                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                                                                title="Delete Permanently"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-sm border transition-all duration-500 ${
                                                            isPerfect 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-500 group-hover:shadow-emerald-200' 
                                                                : 'bg-rose-50 text-rose-700 border-rose-100 group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-500 group-hover:shadow-rose-200'
                                                        }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isPerfect ? 'bg-emerald-500 group-hover:bg-white' : 'bg-rose-500 group-hover:bg-white'}`} />
                                                            {isPerfect ? 'Balanced' : 'Discrepancy'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-8 text-center">
                                                    {role === 'admin' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setEditStartingCash(String(s.startingCash || 0));
                                                                setEditStartingCard(String(s.startingcard || 0));
                                                                setEditClosingCash(String(s.actualClosingCash || 0));
                                                                setEditClosingCard(String(s.actualclosingcard || 0));
                                                                setEditingShift(s);
                                                                setIsEditDialogOpen(true);
                                                            }}
                                                            className="h-9 w-9 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
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
                                    value={startingcardInput}
                                    onChange={(e) => setStartingCardInput(e.target.value)}
                                    placeholder="0"
                                    className="h-12 text-lg font-black text-center"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={() => openShiftMutation.mutate({ 
                                cash: parseFloat(startingCashInput) || 0, 
                                card: parseFloat(startingcardInput) || 0 
                            })}
                            disabled={!startingCashInput || openShiftMutation.isPending}
                            className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm transition-all shadow-lg shadow-emerald-200"
                        >
                            {openShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Start Shift Session
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
                            className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm transition-all shadow-lg shadow-rose-200"
                        >
                            {closeShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Terminate Shift & Lock Records
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
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Select Date to Backdate</label>
                            <Input
                                type="date"
                                value={backdateDate}
                                onChange={(e) => setBackdateDate(e.target.value)}
                                className="h-12 font-black text-lg"
                            />
                            <p className="text-[11px] text-slate-400 font-medium italic">
                                Calculations update automatically for the chosen date.
                            </p>
                        </div>
                        
                        <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Calculated Cash In</span>
                                <span className="font-bold text-emerald-600">+{(backdateFinancials?.cashIn || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Calculated Cash Out</span>
                                <span className="font-bold text-orange-600">-{(backdateFinancials?.cashExpenses || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 border-t pt-1 mt-1">
                                <span>Net Difference</span>
                                <span>{(backdateFinancials?.netCash || 0) > 0 ? '+' : ''}{(backdateFinancials?.netCash || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Starting Cash (Float)</label>
                                <Input
                                    type="number"
                                    value={backdateStartingCash}
                                    onChange={(e) => setBackdateStartingCash(e.target.value)}
                                    placeholder="Opening cash"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Starting Card (Balance)</label>
                                <Input
                                    type="number"
                                    value={backdateStartingCard}
                                    onChange={(e) => setBackdateStartingCard(e.target.value)}
                                    placeholder="Opening card"
                                />
                            </div>
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
                            disabled={!backdateStartingCash || !backdateStartingCard || !backdateClosingCash || !backdateClosingCard || addHistoricalShiftMutation.isPending}
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Corrected Start Cash</label>
                                <Input
                                    type="number"
                                    value={editStartingCash}
                                    onChange={(e) => setEditStartingCash(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Corrected Start Card</label>
                                <Input
                                    type="number"
                                    value={editStartingCard}
                                    onChange={(e) => setEditStartingCard(e.target.value)}
                                />
                            </div>
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
                            disabled={!editStartingCash || !editStartingCard || !editClosingCash || !editClosingCard || editShiftMutation.isPending}
                            className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm relative overflow-hidden"
                        >
                            {editShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin relative z-10" />}
                            <span className="relative z-10">Update Shift Record</span>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-black text-rose-600">
                            <AlertTriangle className="w-6 h-6" />
                            Permanent Deletion
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4 text-center">
                        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                            <p className="text-sm font-bold text-rose-800">Warning: Critical Action</p>
                            <p className="text-xs text-rose-600 mt-1 leading-relaxed">
                                You are about to permanently remove this shift record from the audit history. This will create a gap in your financial trail. This action cannot be undone.
                            </p>
                        </div>
                        
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 h-12 font-black uppercase text-[10px] tracking-widest"
                                onClick={() => setIsDeleteDialogOpen(false)}
                            >
                                Keep Record
                            </Button>
                            <Button
                                className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-200"
                                onClick={() => shiftToDelete && deleteShiftMutation.mutate(shiftToDelete)}
                                disabled={deleteShiftMutation.isPending}
                            >
                                {deleteShiftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
