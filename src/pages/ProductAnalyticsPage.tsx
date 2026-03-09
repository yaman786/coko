import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Search, ChevronDown, ChevronUp, Download, FileText, TableProperties, Loader2, ArrowLeft, History, TrendingUp, ChevronRight, Layers, List, AlertTriangle } from 'lucide-react';
import { DropdownMenu } from '../components/ui/DropdownMenu';
import { getTopProducts } from '../utils/analytics';
import { usePageTitle } from '../hooks/usePageTitle';
import { exportToCSV } from '../utils/export';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Link } from 'react-router-dom';
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
                const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
                return { category, items, revenue, cost, profit, quantity, marginPct };
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

        const tableData = products.map((p, index) => [
            index + 1,
            p.name,
            p.quantity.toString(),
            `Nrs. ${p.revenue.toLocaleString()}`,
            `Nrs. ${p.cost.toLocaleString()}`,
            `Nrs. ${p.profit.toLocaleString()}`,
            `${p.marginPct.toFixed(1)}%`
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['#', 'Product', 'Sold', 'Gross Rev', 'Total Cost', 'Gross Profit', 'Margin']],
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

    return (
        <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Link to="/dashboard" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Product Analytics</h1>
                        <p className="text-slate-500 text-sm hidden sm:block">Deep dive into profitability and performance.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Period Selector */}
                    <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200 shadow-sm overflow-x-auto w-full max-w-[100vw]">
                        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md capitalize transition-colors min-h-[36px] whitespace-nowrap ${period === p
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-slate-600 hover:bg-slate-50'
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
                                <span className="hidden sm:inline">Export</span>
                            </>
                        }
                        buttonClassName="border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 h-[36px] md:h-[40px] shrink-0 min-w-10"
                        items={[
                            {
                                label: 'Export as PDF',
                                icon: FileText,
                                onClick: handleExportPDF
                            },
                            {
                                label: 'Export as CSV',
                                icon: TableProperties,
                                onClick: handleExportCSV
                            }
                        ]}
                    />
                </div>
            </div>

            {/* Visual Analytics - Pareto Chart */}
            <Card className="border-t-4 border-t-purple-600 shadow-md">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        Profit Contribution (Top 10 Products)
                    </CardTitle>
                    <CardDescription>
                        A visual breakdown of which products are driving your realized net profit.
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
                                    tick={{ fontSize: 11, fill: '#64748b' }}
                                />
                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`Nrs. ${Number(value).toLocaleString()}`, '']}
                                />
                                <Legend verticalAlign="top" height={36} />
                                <Bar
                                    name="Gross Profit"
                                    dataKey="profit"
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
            <Card className="border-t-4 border-t-pink-500 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

                        <div className="relative flex-1 md:w-72 md:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white"
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
                                <p>Crunching product metrics...</p>
                            </div>
                        ) : isError ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-500 bg-red-50/50 rounded-lg m-4 border border-red-100">
                                <AlertTriangle className="w-8 h-8" />
                                <div className="text-center">
                                    <p className="font-bold">Analytics Data Error</p>
                                    <p className="text-sm opacity-80 max-w-md">{(error as any)?.message || 'Unknown database error'}</p>
                                </div>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm font-semibold transition-colors"
                                >
                                    Retry Connection
                                </button>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                <p>No performance data found for this period.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 font-bold tracking-wider cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-1">Product <SortIcon field="name" /></div>
                                        </th>
                                        <th className="px-6 py-4 font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('quantity')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="quantity" /> Qty Sold</div>
                                        </th>
                                        <th className="px-6 py-4 font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('revenue')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="revenue" /> Gross Rev</div>
                                        </th>
                                        <th className="px-6 py-4 font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('cost')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="cost" /> Total Cost</div>
                                        </th>
                                        <th className="px-6 py-4 font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('profit')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="profit" /> Gross Profit</div>
                                        </th>
                                        <th className="px-6 py-4 font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('marginPct')}>
                                            <div className="flex items-center justify-end gap-1"><SortIcon field="marginPct" /> Margin %</div>
                                        </th>
                                        <th className="px-6 py-4 font-bold tracking-wider text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {viewMode === 'item' ? (
                                        <>
                                            {products.map((product, index, arr) => {
                                                let marginColorBadge = 'bg-slate-50 text-slate-500 border-slate-200';
                                                if (product.marginPct <= 0) marginColorBadge = 'bg-red-100 text-red-700 border-red-200 font-bold';
                                                else if (product.marginPct < 30) marginColorBadge = 'bg-amber-100 text-amber-700 border-amber-200 font-bold';

                                                const maxProfit = arr.length > 0 ? Math.max(...arr.map(p => p.profit)) : 1;
                                                const profitPacing = maxProfit > 0 ? (Math.max(0, product.profit) / maxProfit) * 100 : 0;

                                                const renderDelta = (deltaPct?: number) => {
                                                    if (deltaPct === undefined || deltaPct === 0) return null;
                                                    const isPositive = deltaPct > 0;
                                                    return (
                                                        <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded-md font-medium inline-block ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                            {isPositive ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}%
                                                        </span>
                                                    );
                                                };

                                                return (
                                                    <tr key={index} className="hover:bg-slate-50/80 transition-colors group relative">
                                                        <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                                                            <div className="w-8 flex-none text-xs text-slate-400">#{index + 1}</div>
                                                            {product.name}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-full bg-slate-100 text-slate-800 font-semibold px-2">
                                                                {product.quantity}
                                                            </span>
                                                            {renderDelta(product.quantityDeltaPct)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-slate-400 font-normal">
                                                            Nrs. {product.revenue.toLocaleString()}
                                                            {renderDelta(product.revenueDeltaPct)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-slate-400 font-normal">
                                                            Nrs. {product.cost.toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-[15px] relative overflow-hidden">
                                                            <div className="flex justify-end items-center relative z-10 w-full">
                                                                <span>Nrs. {product.profit.toLocaleString()}</span>
                                                                {renderDelta(product.profitDeltaPct)}
                                                            </div>
                                                            <div
                                                                className="absolute top-1 right-1 bottom-1 bg-purple-100 rounded-md z-0 transition-all duration-500"
                                                                style={{ width: `calc(${Math.max(0, profitPacing)}% - 8px)`, opacity: 0.6 }}
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Badge variant="outline" className={`${marginColorBadge} font-mono shadow-sm`}>
                                                                {product.marginPct.toFixed(1)}%
                                                            </Badge>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
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
                                            {categoryGroups.map((group) => {
                                                const isExpanded = expandedCategories.has(group.category);
                                                let catMarginBadge = 'bg-slate-50 text-slate-500 border-slate-200';
                                                if (group.marginPct <= 0) catMarginBadge = 'bg-red-100 text-red-700 border-red-200 font-bold';
                                                else if (group.marginPct < 30) catMarginBadge = 'bg-amber-100 text-amber-700 border-amber-200 font-bold';

                                                return (
                                                    <React.Fragment key={group.category}>
                                                        {/* Category Header Row */}
                                                        <tr
                                                            className="bg-purple-50/60 hover:bg-purple-50 cursor-pointer transition-colors border-b border-purple-100"
                                                            onClick={() => toggleCategory(group.category)}
                                                        >
                                                            <td className="px-6 py-4 font-bold text-purple-900 flex items-center gap-2">
                                                                <ChevronRight className={`w-4 h-4 text-purple-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                                <Layers className="w-4 h-4 text-purple-400" />
                                                                {group.category}
                                                                <span className="text-xs text-purple-400 font-normal ml-1">({group.items.length} items)</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right font-bold text-purple-800">{group.quantity}</td>
                                                            <td className="px-6 py-4 text-right font-semibold text-purple-700">Nrs. {group.revenue.toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-right text-purple-600">Nrs. {group.cost.toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-right font-black text-purple-900 text-[15px]">Nrs. {group.profit.toLocaleString()}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <Badge variant="outline" className={`${catMarginBadge} font-mono shadow-sm`}>
                                                                    {group.marginPct.toFixed(1)}%
                                                                </Badge>
                                                            </td>
                                                            <td className="px-6 py-4 text-right"></td>
                                                        </tr>
                                                        {/* Expanded Child Rows */}
                                                        {isExpanded && group.items.map((product, idx) => {
                                                            let marginColorBadge = 'bg-slate-50 text-slate-500 border-slate-200';
                                                            if (product.marginPct <= 0) marginColorBadge = 'bg-red-100 text-red-700 border-red-200 font-bold';
                                                            else if (product.marginPct < 30) marginColorBadge = 'bg-amber-100 text-amber-700 border-amber-200 font-bold';

                                                            return (
                                                                <tr key={`${group.category}-${idx}`} className="bg-white hover:bg-slate-50/60 transition-colors border-b border-slate-50">
                                                                    <td className="px-6 py-3 font-medium text-slate-700 flex items-center gap-3">
                                                                        <div className="w-8 flex-none"></div>
                                                                        <div className="w-4 flex-none border-l-2 border-purple-200 h-4"></div>
                                                                        {product.name}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right text-slate-600">{product.quantity}</td>
                                                                    <td className="px-6 py-3 text-right text-slate-400">Nrs. {product.revenue.toLocaleString()}</td>
                                                                    <td className="px-6 py-3 text-right text-slate-400">Nrs. {product.cost.toLocaleString()}</td>
                                                                    <td className="px-6 py-3 text-right font-semibold text-slate-800">Nrs. {product.profit.toLocaleString()}</td>
                                                                    <td className="px-6 py-3 text-right">
                                                                        <Badge variant="outline" className={`${marginColorBadge} font-mono shadow-sm text-[11px]`}>
                                                                            {product.marginPct.toFixed(1)}%
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right">
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
                                        <td className="px-6 py-4 text-slate-800">Grand Total</td>
                                        <td className="px-6 py-4 text-right text-slate-800">
                                            {products.reduce((acc, p) => acc + p.quantity, 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-800">
                                            Nrs. {products.reduce((acc, p) => acc + p.revenue, 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-800">
                                            Nrs. {products.reduce((acc, p) => acc + p.cost, 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-800">
                                            Nrs. {products.reduce((acc, p) => acc + p.profit, 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-800">
                                            -
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-800">
                                        </td>
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
