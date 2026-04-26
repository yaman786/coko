// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Search, ChevronDown, ChevronUp, Download, FileText, TableProperties, Loader2, ArrowLeft, History, TrendingUp, ChevronRight, Layers, List, AlertTriangle, Flame, AlertCircle, TrendingDown, CheckCircle2, Scale, Gem } from 'lucide-react';
import { DropdownMenu } from '../components/ui/DropdownMenu';
import { getTopProducts } from '../utils/analytics';
import { usePageTitle } from '../hooks/usePageTitle';
import { exportToCSV } from '../utils/export';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { AuditLogEntry } from '../types';
import { ProductDailyLedgerDialog } from '../features/inventory/components/ProductDailyLedgerDialog';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Legend
} from 'recharts';

type SortField = 'name' | 'quantity' | 'revenue' | 'cost' | 'profit' | 'marginPct';
type SortOrder = 'asc' | 'desc';

export function ProductAnalyticsPage() {
    usePageTitle('Product Analytics');

    // Filters & Sorting state
    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('profit');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    const [selectedProductForLedger, setSelectedProductForLedger] = useState<{ id: string; name: string } | null>(null);
    const [viewMode, setViewMode] = useState<'item' | 'category'>('item');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [marginFilter, setMarginFilter] = useState<'all' | 'low' | 'loss'>('all');

    // Date calculations
    const days = period === 'today' ? 1
        : period === 'week' ? 7
            : period === 'month' ? 30
                : (customFrom && customTo)
                    ? Math.max(1, Math.ceil((new Date(customTo).getTime() - new Date(customFrom).getTime()) / 86400000) + 1)
                    : 30;

    const dateFilter = (period === 'custom' && customFrom && customTo)
        ? { start: new Date(customFrom), end: new Date(customTo) }
        : period === 'custom' ? 30 : days;

    const queryKeyDatePart = typeof dateFilter === 'number' ? dateFilter : `${customFrom}_${customTo}`;

    // Fetch data (using 999999 as limit to get all products)
    const { data: rawProducts = [], isLoading, isError, error } = useQuery({
        queryKey: ['allProductAnalytics', queryKeyDatePart],
        queryFn: () => getTopProducts(999999, dateFilter),
    });

    const { data: adjustments = [] } = useQuery({
        queryKey: ['stockAdjustments', queryKeyDatePart],
        queryFn: async () => {
            const logs: AuditLogEntry[] = await api.getAuditLog(1000);
            const start = typeof dateFilter === 'number' ? new Date(Date.now() - dateFilter * 86400000) : dateFilter.start;
            const end = typeof dateFilter === 'number' ? new Date() : dateFilter.end;
            
            return logs.filter((l: AuditLogEntry) => 
                l.action === 'STOCK_ADJUSTMENT' && 
                new Date(l.createdAt) >= start &&
                new Date(l.createdAt) <= end
            );
        },
    });

    const reconciliationStats = useMemo(() => {
        let profitGains = 0;
        let leakageLosses = 0;
        let gainCount = 0;
        let lossCount = 0;
        
        // Only show entries for products that still exist
        const existingProductIds = new Set(rawProducts.map((p: any) => p.id));

        adjustments.forEach((log: AuditLogEntry) => {
            const productId = log.metadata?.productId as string;
            if (productId && !existingProductIds.has(productId)) return;

            // EMERGENCY FILTER: Hide messy 21st Love logs from today (March 26, 2026)
            const isToday = new Date(log.createdAt).toISOString().split('T')[0] === '2026-03-26';
            if (isToday && log.description?.includes('21st Love 1000ML')) return;
            if (isToday && log.description?.includes('test')) return;

            const val = log.metadata?.variance_value as number || 0;
            const type = log.metadata?.variance_type as string;
            
            if (type === 'PROFIT_GAIN') {
                profitGains += val;
                gainCount++;
            }
            if (type === 'ASSET_LOSS') {
                leakageLosses += val;
                lossCount++;
            }
        });
        
        return { profitGains, leakageLosses, gainCount, lossCount };
    }, [adjustments, rawProducts]);

    const reconciliationList = useMemo(() => {
        const existingProductIds = new Set(rawProducts.map((p: any) => p.id));
        return adjustments
            .filter((log: AuditLogEntry) => {
                const productId = log.metadata?.productId as string;
                return productId && existingProductIds.has(productId);
            })
            .map((log: AuditLogEntry) => ({
                id: log.id,
                productId: log.metadata?.productId as string,
                productName: (log.metadata?.name as string) || 'Unknown',
                type: log.metadata?.variance_type as 'PROFIT_GAIN' | 'ASSET_LOSS',
                variance: Number(log.metadata?.variance) || 0,
                value: Number(log.metadata?.variance_value) || 0,
                reason: (log.metadata?.reason as string) || 'Adjustment',
                timestamp: log.createdAt
            }))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 20);
    }, [adjustments, rawProducts]);

    // Process Date Label
    const getDateRangeLabel = () => {
        if (period === 'today') return 'Today';
        if (period === 'week') return 'Last 7 Days';
        if (period === 'month') return 'Last 30 Days';
        return `${format(new Date(customFrom || new Date()), 'MMM d')} - ${format(new Date(customTo || new Date()), 'MMM d, yyyy')}`;
    };

    // Available categories from data
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        rawProducts.forEach(p => cats.add(p.category || 'Uncategorized'));
        return Array.from(cats).sort();
    }, [rawProducts]);

    // Filter and Sort Logic
    const products = useMemo(() => {
        let result = [...rawProducts];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(query));
        }

        // Category filter
        if (selectedCategory !== 'all') {
            result = result.filter(p => (p.category || 'Uncategorized') === selectedCategory);
        }

        // Margin filter
        if (marginFilter === 'low') {
            result = result.filter(p => p.marginPct > 0 && p.marginPct < 30);
        } else if (marginFilter === 'loss') {
            result = result.filter(p => p.marginPct <= 0);
        }

        result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            return sortOrder === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });

        return result;
    }, [rawProducts, searchQuery, sortField, sortOrder, selectedCategory, marginFilter]);

    // Category Grouping Logic
    interface CategoryGroup {
        category: string;
        items: typeof products;
        revenue: number;
        cost: number;
        profit: number;
        quantity: number;
        marginPct: number;
        discounts: number;
    }

    const categoryGroups = useMemo((): CategoryGroup[] => {
        const groupMap = new Map<string, typeof products>();
        for (const p of products) {
            const cat = p.category || 'Uncategorized';
            if (!groupMap.has(cat)) groupMap.set(cat, []);
            groupMap.get(cat)!.push(p);
        }
        return Array.from(groupMap.entries())
            .map(([category, items]) => {
                const revenue = items.reduce((s, i) => s + i.revenue, 0);
                const cost = items.reduce((s, i) => s + i.cost, 0);
                const profit = revenue - cost;
                const quantity = items.reduce((s, i) => s + i.quantity, 0);
                const discounts = items.reduce((s, i) => s + (i.discounts || 0), 0);
                const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
                return { category, items, revenue, cost, profit, quantity, marginPct, discounts };
            })
            .sort((a, b) => b.profit - a.profit);
    }, [products]);

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc'); // default to high-to-low for analytics
        }
    };

    // Exports
    const handleExportCSV = () => {
        exportToCSV(products, `product-analytics-${format(new Date(), 'yyyy-MM-dd')}`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text('Coko POS - Product Analytics Report', 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Period: ${getDateRangeLabel()}`, 14, 30);
        doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 36);

        const tableData = products.map((p, index) => {
            const asp = p.quantity > 0 ? p.revenue / p.quantity : 0;
            return [
                index + 1,
                p.name,
                p.quantity.toString(),
                `Nrs. ${asp.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                `Nrs. ${p.revenue.toLocaleString()}`,
                `Nrs. ${(p.discounts || 0).toLocaleString()}`,
                `Nrs. ${p.cost.toLocaleString()}`,
                `Nrs. ${p.profit.toLocaleString()}`,
                `${p.marginPct.toFixed(1)}%`
            ]
        });

        autoTable(doc, {
            startY: 45,
            head: [['#', 'Product', 'Sold', 'ASP', 'Gross Rev', 'Discounts', 'Total Cost', 'Gross Profit', 'Margin']],
            body: tableData,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [147, 51, 234] }, // purple-600
        });

        doc.save(`Product_Analytics_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
    };

    const getInsightTag = (p: { marginPct: number, quantityDeltaPct?: number }, isTopEarner: boolean) => {
        if (p.marginPct < 0) return { label: 'Loss Maker', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
        if (p.marginPct > 50 && (p.quantityDeltaPct || 0) > 20) return { label: 'Hot Seller', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Flame };
        if (isTopEarner) return { label: 'Cash Cow', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
        if ((p.quantityDeltaPct || 0) < -10) return { label: 'Slipping', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: TrendingDown };
        return { label: 'Stable', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: null };
    };

    return (
        <div className="flex-1 space-y-8 p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-2">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard" className="p-3 bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-full hover:bg-slate-100 transition-all shadow-sm">
                        <ArrowLeft className="w-5 h-5 text-slate-800" />
                    </Link>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">
                            Product <span className="text-purple-600">Performance</span>
                        </h1>
                        <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif]">Comprehensive audit of profitability and realized margins.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Period Selector */}
                    <div className="flex items-center gap-1.5 bg-white/50 backdrop-blur-md rounded-full p-1.5 border border-slate-200/60 shadow-inner">
                        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 ${period === p
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    {period === 'custom' && (
                        <div className="flex items-center bg-white rounded-lg px-2 py-1.5 border border-slate-200 shadow-sm shrink-0">
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="text-xs md:text-sm border-0 bg-transparent text-slate-700 focus:outline-none w-[110px]"
                            />
                            <span className="text-slate-400 text-xs px-1">to</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="text-xs md:text-sm border-0 bg-transparent text-slate-700 focus:outline-none w-[110px]"
                            />
                        </div>
                    )}

                    <DropdownMenu
                        buttonContent={
                            <>
                                <Download className="w-4 h-4 text-purple-600" />
                                <span className="hidden sm:inline">Export Audit</span>
                            </>
                        }
                        buttonClassName="border-slate-200/60 bg-white/80 backdrop-blur-xl hover:bg-white text-slate-700 h-[44px] shrink-0 rounded-full font-black text-[10px] uppercase tracking-widest px-6 shadow-sm transition-all"
                        items={[
                            {
                                label: 'Intelligence PDF',
                                icon: FileText,
                                onClick: handleExportPDF
                            },
                            {
                                label: 'Raw CSV',
                                icon: TableProperties,
                                onClick: handleExportCSV
                            }
                        ]}
                    />
                </div>
            </div>

            {/* Financial Reconciliation Section — Top Banner */}
            {!isLoading && (reconciliationStats.gainCount > 0 || reconciliationStats.lossCount > 0) && (
                <Card className="bg-emerald-50/40 backdrop-blur-3xl border-emerald-200/60 shadow-2xl rounded-[2rem] overflow-hidden border">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="flex items-center gap-2 text-emerald-800 font-['DM_Sans',sans-serif] font-black tracking-tight text-xl">
                            <Scale className="w-6 h-6" />
                            Financial Truth & Reconciliation
                        </CardTitle>
                        <CardDescription className="text-emerald-600/70 font-medium">
                            {reconciliationStats.gainCount + reconciliationStats.lossCount} automated yield adjustments recorded this period.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Gains */}
                            <div className="flex items-center gap-3 bg-white/80 border border-emerald-200 rounded-xl p-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                    <Gem className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Found Revenue (Gains)</p>
                                    <p className="text-xl font-black text-emerald-700">Nrs. {reconciliationStats.profitGains.toLocaleString()}</p>
                                    <p className="text-[11px] text-emerald-600">{reconciliationStats.gainCount} over-yield events</p>
                                </div>
                            </div>
                            {/* Losses */}
                            <div className="flex items-center gap-3 bg-white/80 border border-rose-200 rounded-xl p-4">
                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                    <TrendingDown className="w-5 h-5 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Asset Leakage (Losses)</p>
                                    <p className="text-xl font-black text-rose-700">Nrs. {reconciliationStats.leakageLosses.toLocaleString()}</p>
                                    <p className="text-[11px] text-rose-600">{reconciliationStats.lossCount} negative variances</p>
                                </div>
                            </div>
                            {/* Net */}
                            <div className="flex items-center gap-3 bg-white/80 border border-slate-200 rounded-xl p-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                    reconciliationStats.profitGains >= reconciliationStats.leakageLosses ? 'bg-emerald-100' : 'bg-rose-100'
                                }`}>
                                    <Scale className={`w-5 h-5 ${
                                        reconciliationStats.profitGains >= reconciliationStats.leakageLosses ? 'text-emerald-600' : 'text-rose-600'
                                    }`} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Net Inventory Impact</p>
                                    <p className={`text-xl font-black ${
                                        reconciliationStats.profitGains >= reconciliationStats.leakageLosses ? 'text-emerald-700' : 'text-rose-700'
                                    }`}>
                                        {reconciliationStats.profitGains >= reconciliationStats.leakageLosses ? '+' : '-'}Nrs. {Math.abs(reconciliationStats.profitGains - reconciliationStats.leakageLosses).toLocaleString()}
                                    </p>
                                    <p className="text-[11px] text-slate-500">{reconciliationStats.profitGains >= reconciliationStats.leakageLosses ? 'Net Positive' : 'Net Negative'} impact</p>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Reconciliation List */}
                        {reconciliationList.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-emerald-100">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-800">Individual Adjustments (Recent)</h4>
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Audit Trail</span>
                                </div>
                                <div className="space-y-2 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-emerald-100 pr-1">
                                    {reconciliationList.map((log) => (
                                        <div key={log.id} className="flex items-center justify-between p-2.5 bg-white border border-emerald-50 rounded-lg hover:border-emerald-200 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                    log.type === 'PROFIT_GAIN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                                }`}>
                                                    {log.type === 'PROFIT_GAIN' ? <Gem className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{log.productName}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">
                                                        {log.reason} • {format(new Date(log.timestamp), 'MMM d, h:mm a')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xs font-black ${
                                                    log.type === 'PROFIT_GAIN' ? 'text-emerald-700' : 'text-rose-700'
                                                }`}>
                                                    {log.type === 'PROFIT_GAIN' ? '+' : '-'}{log.value.toLocaleString()} Nrs
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                    {log.variance > 0 ? '+' : ''}{log.variance} Units
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Visual Analytics - Pareto Chart */}
            <Card className="bg-white/40 backdrop-blur-3xl border-slate-200/60 shadow-2xl rounded-[2.5rem] overflow-hidden border">
                <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif] flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-purple-600" />
                        Profit Map <span className="text-purple-600/50">(Pareto 80/20)</span>
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium font-['DM_Sans',sans-serif]">
                        Which products are truly fueling your net liquidity?
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={products.slice(0, 10)}
                                margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis
                                    dataKey="name"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    interval={0}
                                    tick={{ fontSize: 11, fill: '#7c3aed' }}
                                />
                                <YAxis tick={{ fontSize: 11, fill: '#7c3aed' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e9d5ff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#faf5ff' }}
                                    labelStyle={{ color: '#7c3aed', fontWeight: 'bold', marginBottom: '4px' }}
                                    formatter={(value: any) => [`Nrs. ${Number(value).toLocaleString()}`, 'Gross Profit']}
                                    cursor={{ fill: 'rgba(147, 51, 234, 0.08)' }}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Bar
                                    name="Gross Profit"
                                    dataKey="profit"
                                    fill="#9333ea"
                                    radius={[4, 4, 0, 0]}
                                >
                                    {products.slice(0, 10).map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.profit > 0 ? '#9333ea' : '#ef4444'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Main Content */}
            <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm border-t-4 border-t-pink-500 rounded-2xl overflow-hidden">
                <CardHeader className="bg-white/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <CardTitle className="text-lg text-slate-800">Performance Ledger</CardTitle>
                        <CardDescription>Metrics for {getDateRangeLabel()}</CardDescription>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {/* View Mode Toggle */}
                        <div className="flex items-center bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                            <button
                                onClick={() => setViewMode('item')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'item' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <List className="w-3.5 h-3.5" /> Items
                            </button>
                            <button
                                onClick={() => setViewMode('category')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'category' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <Layers className="w-3.5 h-3.5" /> Categories
                            </button>
                        </div>

                        <div className="relative flex-1 md:w-72 md:flex-none mt-2 md:mt-0">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-10 bg-white border-slate-200/60 rounded-full focus:ring-2 focus:ring-indigo-500/20 font-['DM_Sans',sans-serif] shadow-sm text-sm"
                            />
                        </div>
                    </div>
                </CardHeader>

                {/* Phase 3: Advanced Filter Bar */}
                {!isLoading && rawProducts.length > 0 && (
                    <div className="px-4 md:px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
                        {/* Category Chips */}
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${selectedCategory === 'all' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                        >
                            All Categories
                        </button>
                        {availableCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat === selectedCategory ? 'all' : cat)}
                                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${selectedCategory === cat ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}

                        <div className="w-px h-5 bg-slate-200 mx-1"></div>

                        {/* Margin Threshold Filters */}
                        <button
                            onClick={() => setMarginFilter(marginFilter === 'low' ? 'all' : 'low')}
                            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${marginFilter === 'low' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600 border border-amber-200 hover:bg-amber-50'
                                }`}
                        >
                            ⚠ Low Margin (&lt;30%)
                        </button>
                        <button
                            onClick={() => setMarginFilter(marginFilter === 'loss' ? 'all' : 'loss')}
                            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${marginFilter === 'loss' ? 'bg-red-500 text-white' : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                                }`}
                        >
                            🚨 Loss Makers
                        </button>
                    </div>
                )}

                <CardContent className="p-0">
                    <div className="overflow-x-auto min-h-[400px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                                <p className="font-black text-[10px] uppercase tracking-widest">Crunching Performance Metrics...</p>
                            </div>
                        ) : isError ? (
                            <div className="flex flex-col items-center justify-center p-12 gap-4 text-rose-500 bg-rose-50/50 rounded-2xl m-8 border border-rose-100 italic">
                                <AlertTriangle className="w-10 h-10" />
                                <div className="text-center">
                                    <p className="font-black uppercase tracking-tight">Database Connection Intermittent</p>
                                    <p className="text-xs opacity-80 mt-1">{(error as any)?.message || 'Service latency detected'}</p>
                                </div>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-4">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center shadow-inner">
                                    <History className="w-10 h-10 text-slate-300" />
                                </div>
                                <p className="font-black text-[10px] uppercase tracking-widest">No activity found for this period.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left border-separate border-spacing-0">
                                <thead className="text-[10px] text-slate-400 uppercase bg-transparent sticky top-0 z-10 font-black tracking-[0.2em] font-['DM_Sans',sans-serif]">
                                    <tr className="bg-white/60 backdrop-blur-md">
                                        <th className="px-6 py-5 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-1">Product Descriptor <SortIcon field="name" /></div>
                                        </th>
                                        <th className="px-6 py-5 text-right cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('quantity')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="quantity" /> Movement</div>
                                        </th>
                                        <th className="px-6 py-5 text-right">ASP</th>
                                        <th className="px-6 py-5 text-right cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('revenue')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="revenue" /> Realized Rev</div>
                                        </th>
                                        <th className="px-6 py-5 text-slate-400 text-right">Burn</th>
                                        <th className="px-6 py-5 text-right">COGS</th>
                                        <th className="px-6 py-5 text-slate-800 text-right cursor-pointer hover:text-black transition-colors" onClick={() => handleSort('profit')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="profit" /> Net Liquidity</div>
                                        </th>
                                        <th className="px-6 py-5 text-left cursor-pointer hover:text-slate-800 transition-colors font-black tracking-widest" onClick={() => handleSort('marginPct')}>
                                            <div className="flex items-center gap-1"><SortIcon field="marginPct" /> Health</div>
                                        </th>
                                        <th className="px-6 py-5 text-center w-[120px]">Audit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewMode === 'item' ? (
                                        <>
                                            {products.map((product, index, arr) => {
                                                const maxProfit = arr.length > 0 ? Math.max(...arr.map(p => p.profit)) : 1;
                                                const profitPacing = maxProfit > 0 ? (Math.max(0, product.profit) / maxProfit) * 100 : 0;

                                                // Identify top 20% earners for Cash Cow
                                                const topEarnersCount = Math.max(1, Math.ceil(arr.length * 0.2));
                                                const isTopEarner = index < topEarnersCount;
                                                const insight = getInsightTag(product, isTopEarner);
                                                const InsightIcon = insight.icon;

                                                const renderDelta = (deltaPct?: number) => {
                                                    if (deltaPct === undefined || deltaPct === 0) return null;
                                                    const isPositive = deltaPct > 0;
                                                    return (
                                                        <div className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-md font-medium inline-block flex-shrink-0 whitespace-nowrap ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                            {isPositive ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}%
                                                        </div>
                                                    );
                                                };

                                                const asp = product.quantity > 0 ? product.revenue / product.quantity : 0;
                                                const discounts = product.discounts || 0;

                                                return (
                                                    <tr key={index} className="hover:bg-slate-50/80 transition-colors group relative">
                                                        <td className="px-4 py-3 font-medium text-slate-900 w-1/4">
                                                            <div className="flex items-start gap-2">
                                                                <span className="w-6 flex-none text-xs text-slate-400 mt-0.5">#{index + 1}</span>
                                                                <span className="whitespace-normal leading-tight">{product.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right align-top">
                                                            <div className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-full bg-slate-100 text-slate-800 font-semibold px-2">
                                                                {product.quantity}
                                                            </div>
                                                            <div>{renderDelta(product.quantityDeltaPct)}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-slate-600 align-top">
                                                            {asp > 0 ? `Nrs. ${asp.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right align-top font-bold text-slate-800">
                                                            Nrs. {product.revenue.toLocaleString()}
                                                            <div>{renderDelta(product.revenueDeltaPct)}</div>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right align-top font-medium ${discounts > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                                            {discounts > 0 ? `Nrs. ${discounts.toLocaleString()}` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right align-top text-slate-600">
                                                            Nrs. {product.cost.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-right align-top relative overflow-hidden">
                                                            <div className="flex flex-col justify-end items-end relative z-10 w-full mb-1">
                                                                <span className="font-black text-slate-900 text-[15px]">Nrs. {product.profit.toLocaleString()}</span>
                                                                <div>{renderDelta(product.profitDeltaPct)}</div>
                                                            </div>
                                                            <div
                                                                className="absolute top-1 right-1 bottom-1 bg-purple-100 rounded-md z-0 transition-all duration-500"
                                                                style={{ width: `calc(${Math.max(0, profitPacing)}% - 8px)`, opacity: 0.6 }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-left align-top">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <span className="text-xs font-mono font-semibold text-slate-600">{product.marginPct.toFixed(1)}% Margin</span>
                                                                <Badge variant="outline" className={`${insight.color} shadow-sm border text-[10px] px-1.5 py-0 flex items-center gap-1 whitespace-nowrap`}>
                                                                    {InsightIcon && <InsightIcon className="w-3 h-3" />}
                                                                    {insight.label}
                                                                </Badge>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right align-top">
                                                            <button
                                                                onClick={() => setSelectedProductForLedger({ id: product.id, name: product.name })}
                                                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                                                            >
                                                                <History className="w-3.5 h-3.5" />
                                                                History
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <>
                                            {categoryGroups.map((group, groupIdx) => {
                                                const isExpanded = expandedCategories.has(group.category);
                                                const topEarnersCount = Math.max(1, Math.ceil(categoryGroups.length * 0.2));
                                                const isTopEarner = groupIdx < topEarnersCount;
                                                const insight = getInsightTag({ marginPct: group.marginPct, quantityDeltaPct: 0 }, isTopEarner); // Simplified for group
                                                const InsightIcon = insight.icon;

                                                const groupAsp = group.quantity > 0 ? group.revenue / group.quantity : 0;
                                                return (
                                                    <React.Fragment key={group.category}>
                                                        {/* Category Header Row */}
                                                        <tr
                                                            className="bg-purple-50/60 hover:bg-purple-50 cursor-pointer transition-colors border-b border-purple-100"
                                                            onClick={() => toggleCategory(group.category)}
                                                        >
                                                            <td className="px-4 py-4 font-bold text-purple-900 w-1/4">
                                                                <div className="flex items-start gap-2">
                                                                    <ChevronRight className={`w-4 h-4 text-purple-500 transition-transform duration-200 shrink-0 mt-0.5 ${isExpanded ? 'rotate-90' : ''}`} />
                                                                    <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                                                    <span className="whitespace-normal leading-tight">{group.category}</span>
                                                                    <span className="text-xs text-purple-400 font-normal ml-1 shrink-0">({group.items.length})</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-right font-bold text-purple-800 align-top">{group.quantity}</td>
                                                            <td className="px-4 py-4 text-right align-top font-medium text-purple-600">
                                                                Nrs. {groupAsp.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                            </td>
                                                            <td className="px-4 py-4 text-right align-top font-bold text-purple-800">
                                                                Nrs. {group.revenue.toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-4 text-right align-top font-bold text-red-500">
                                                                {group.discounts > 0 ? `Nrs. ${group.discounts.toLocaleString()}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-4 text-right align-top text-purple-500">
                                                                Nrs. {group.cost.toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-4 text-right font-black text-purple-900 text-[15px] align-top">Nrs. {group.profit.toLocaleString()}</td>
                                                            <td className="px-4 py-4 text-left align-top">
                                                                <div className="flex flex-col items-start gap-1">
                                                                    <span className="text-xs font-mono font-semibold text-purple-700">{group.marginPct.toFixed(1)}% Margin</span>
                                                                    <Badge variant="outline" className={`${insight.color} shadow-sm border text-[10px] px-1.5 py-0 flex items-center gap-1 whitespace-nowrap`}>
                                                                        {InsightIcon && <InsightIcon className="w-3 h-3" />}
                                                                        {insight.label}
                                                                    </Badge>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 text-right"></td>
                                                        </tr>
                                                        {/* Expanded Child Rows */}
                                                        {isExpanded && group.items.map((product, idx) => {
                                                            const pTopEarnersCount = Math.max(1, Math.ceil(group.items.length * 0.2));
                                                            const pIsTopEarner = idx < pTopEarnersCount;
                                                            const pInsight = getInsightTag(product, pIsTopEarner);
                                                            const PInsightIcon = pInsight.icon;

                                                            const pAsp = product.quantity > 0 ? product.revenue / product.quantity : 0;
                                                            return (
                                                                <tr key={`${group.category}-${idx}`} className="bg-white hover:bg-slate-50/60 transition-colors border-b border-slate-50">
                                                                    <td className="px-4 py-3 font-medium text-slate-700 w-1/4">
                                                                        <div className="flex items-start gap-2 pl-3">
                                                                            <div className="w-4 flex-none border-l-2 border-purple-200 h-4 mt-1"></div>
                                                                            <span className="whitespace-normal leading-tight">{product.name}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right text-slate-600 align-top">{product.quantity}</td>
                                                                    <td className="px-4 py-3 text-right align-top text-slate-500">
                                                                        {pAsp > 0 ? `Nrs. ${pAsp.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right align-top font-medium text-slate-700">
                                                                        Nrs. {product.revenue.toLocaleString()}
                                                                    </td>
                                                                    <td className={`px-4 py-3 text-right align-top font-medium ${product.discounts && product.discounts > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                                                        {product.discounts && product.discounts > 0 ? `Nrs. ${product.discounts.toLocaleString()}` : '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right align-top text-slate-500">
                                                                        Nrs. {product.cost.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 align-top">Nrs. {product.profit.toLocaleString()}</td>
                                                                    <td className="px-4 py-3 text-left align-top">
                                                                        <div className="flex flex-col items-start gap-1">
                                                                            <span className="text-xs font-mono text-slate-500">{product.marginPct.toFixed(1)}% Margin</span>
                                                                            <Badge variant="outline" className={`${pInsight.color} shadow-sm border text-[10px] px-1.5 py-0 flex items-center gap-1 whitespace-nowrap`}>
                                                                                {PInsightIcon && <PInsightIcon className="w-3 h-3" />}
                                                                                {pInsight.label}
                                                                            </Badge>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right align-top">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedProductForLedger({ id: product.id, name: product.name }); }}
                                                                            className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                                                                        >
                                                                            <History className="w-3 h-3" />
                                                                            History
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </>
                                    )}

                                    {/* Grand Totals Footer */}
                                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                        <td className="px-4 py-4 text-slate-800">Grand Total</td>
                                        <td className="px-4 py-4 text-right text-slate-800 align-top">
                                            {products.reduce((acc, p) => acc + p.quantity, 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-600 align-top">
                                            {(() => {
                                                const totalQ = products.reduce((acc, p) => acc + p.quantity, 0);
                                                const totalR = products.reduce((acc, p) => acc + p.revenue, 0);
                                                return totalQ > 0 ? `Nrs. ${(totalR / totalQ).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-';
                                            })()}
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-800 align-top">
                                            Nrs. {products.reduce((acc, p) => acc + p.revenue, 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4 text-right text-red-600 align-top">
                                            Nrs. {products.reduce((acc, p) => acc + (p.discounts || 0), 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-600 align-top">
                                            Nrs. {products.reduce((acc, p) => acc + p.cost, 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4 text-right text-slate-900 align-top">
                                            Nrs. {products.reduce((acc, p) => acc + p.profit, 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4"></td>
                                        <td className="px-4 py-4"></td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* History Ledger Dialog */}
            {selectedProductForLedger && (
                <ProductDailyLedgerDialog
                    product={selectedProductForLedger as any}
                    onClose={() => setSelectedProductForLedger(null)}
                />
            )}
        </div>
    );
}
