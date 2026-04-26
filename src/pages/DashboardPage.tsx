import { useState, Component, type ReactNode, type ErrorInfo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../features/dashboard/components/StatCard';
import { RevenueChart } from '../features/dashboard/components/RevenueChart';
import { TopProductsCard } from '../features/dashboard/components/TopProductsCard';
import { RecentOrdersCard } from '../features/dashboard/components/RecentOrdersCard';
import {
    getDashboardMetrics,
    getRevenueTrend,
    getTopProducts,
    getRecentOrders
} from '../utils/analytics';
import { Activity, DollarSign, Package, TrendingUp, ShieldAlert, RefreshCw, Loader2, Download, FileText, TableProperties, Gift, Heart, Percent, CreditCard, Wallet, Receipt, FlaskConical } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { DropdownMenu } from '../components/ui/DropdownMenu';
import { exportToCSV, exportDashboardToPDF } from '../utils/export';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

// Error Boundary to prevent chart/rendering errors from crashing the entire page
class DashboardErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    componentDidCatch(error: Error, info: ErrorInfo) { console.error('Dashboard Error:', error, info); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col h-full items-center justify-center gap-4 p-8">
                    <ShieldAlert className="w-12 h-12 text-amber-500" />
                    <h2 className="text-xl font-bold text-gray-800">Dashboard Recovered</h2>
                    <p className="text-gray-500 text-center max-w-md">A rendering error was caught. Click below to reload.</p>
                    <button onClick={() => this.setState({ hasError: false })} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                        <RefreshCw className="w-4 h-4" /> Reload Dashboard
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export function DashboardPage() {
    return (
        <DashboardErrorBoundary>
            <DashboardContent />
        </DashboardErrorBoundary>
    );
}

function DashboardContent() {
    usePageTitle('Dashboard');
    const { user } = useAuth();
    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    // Calculate days for the query — custom uses date diff
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

    const isWholesale = typeof window !== 'undefined' && window.location.pathname.startsWith('/wholesale');
    const currentPortal = isWholesale ? 'wholesale' : 'retail';

    // 1. Concurrent and Cached Data Fetching — ALL queries use the `dateFilter` period
    const { data: metrics, isLoading: metricsLoading } = useQuery({
        queryKey: ['dashboardMetrics', queryKeyDatePart, currentPortal],
        queryFn: () => {
            console.log('[Query] Fetching metrics for:', dateFilter, currentPortal);
            return getDashboardMetrics(dateFilter, currentPortal);
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    const { data: revenueData = [] } = useQuery({
        queryKey: ['revenueTrend', queryKeyDatePart, currentPortal],
        queryFn: () => {
            console.log('[Query] Fetching revenue trend for:', dateFilter, currentPortal);
            return getRevenueTrend(dateFilter, currentPortal);
        },
    });

    const { data: topProducts = [] } = useQuery({
        queryKey: ['topProducts', queryKeyDatePart, currentPortal],
        queryFn: () => getTopProducts(5, dateFilter, currentPortal),
    });

    const { data: recentOrders = [] } = useQuery({
        queryKey: ['recentOrders', currentPortal],
        queryFn: () => getRecentOrders(10, currentPortal),
    });

    // --- Export Logic ---
    const getDateRangeLabel = () => {
        if (period === 'today') return 'Today';
        if (period === 'week') return 'Last 7 Days';
        if (period === 'month') return 'Last 30 Days';
        return `${format(new Date(customFrom || new Date()), 'MMM d')} - ${format(new Date(customTo || new Date()), 'MMM d, yyyy')}`;
    };

    const handleExportPDF = () => {
        if (!metrics) return;
        exportDashboardToPDF({
            revenue: metrics.totalRevenue,
            grossRevenue: metrics.grossRevenue,
            cashTotal: metrics.cashTotal,
            cardTotal: metrics.cardTotal,
            discounts: metrics.totalDiscounts,
            totalOffers: metrics.totalOffers,
            totalComplimentary: metrics.totalComplimentary,
            totalLoyalty: metrics.totalLoyalty,
            totalCOGS: metrics.totalCOGS,
            totalExpenses: metrics.totalExpenses,
            wasteValue: metrics.wasteValue,
            overYieldValue: metrics.overYieldValue,
            ordersCount: metrics.totalOrders,
            aov: metrics.averageOrderValue,
            topProducts: topProducts.slice(0, 10).map(p => ({ name: p.name, quantity: p.quantity })),
            dateRangeLabel: getDateRangeLabel(),
            adminName: user?.user_metadata?.name || user?.email || 'Admin',
        });
    };

    const handleExportCSV = () => {
        if (!revenueData || revenueData.length === 0) return;
        exportToCSV(revenueData, 'dashboard-analytics');
    };

    if (metricsLoading && !metrics) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-gray-500 font-medium">Crunching live numbers...</p>
            </div>
        );
    }

    if (!metrics) return null;

    return (
        <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-2">
                <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">Executive <span className="text-purple-600">Overview</span></h1>
                        <p className="text-slate-500 font-medium text-sm hidden sm:block font-['DM_Sans',sans-serif]">Real-time intelligence and shop performance audit.</p>
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black shadow-inner bg-emerald-50/50 text-emerald-600 border border-emerald-200/40 font-['DM_Sans',sans-serif] tracking-widest uppercase">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Feed
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white/50 backdrop-blur-md rounded-full p-1.5 border border-slate-200/60 shadow-inner">
                        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 min-h-[40px] ${period === p
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    {period === 'custom' && (
                        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-xl rounded-xl px-4 py-2 border border-slate-200/60 shadow-sm">
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="text-xs md:text-sm font-bold font-['DM_Sans',sans-serif] border-0 bg-transparent text-slate-700 focus:outline-none"
                            />
                            <span className="text-slate-400 text-xs font-bold leading-none">to</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="text-xs md:text-sm font-bold font-['DM_Sans',sans-serif] border-0 bg-transparent text-slate-700 focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Export Dropdown */}
                    <div className="ml-1">
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
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                <StatCard
                    title="Total Revenue"
                    value={`Nrs. ${metrics.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    trend={{ value: Math.abs(Number(metrics.trends.revenueDeltaPct.toFixed(1))), isPositive: metrics.trends.revenueDeltaPct >= 0 }}
                />
                <StatCard
                    title="Total Orders"
                    value={metrics.totalOrders.toString()}
                    icon={Activity}
                    trend={{ value: Math.abs(Number(metrics.trends.ordersDeltaPct.toFixed(1))), isPositive: metrics.trends.ordersDeltaPct >= 0 }}
                />
                <StatCard
                    title="Avg. Order Value"
                    value={`Nrs. ${metrics.averageOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    icon={TrendingUp}
                    trend={{ value: Math.abs(Number(metrics.trends.aovDeltaPct.toFixed(1))), isPositive: metrics.trends.aovDeltaPct >= 0 }}
                />
                <StatCard
                    title="Products Sold"
                    value={metrics.totalProductsSold.toString()}
                    icon={Package}
                    trend={{ value: Math.abs(Number(metrics.trends.productsDeltaPct.toFixed(1))), isPositive: metrics.trends.productsDeltaPct >= 0 }}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Financial Breakdown */}
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-200/60 p-8 shadow-2xl border">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 font-['DM_Sans',sans-serif]">Financial Reconciliation</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                                Gross Sales
                            </div>
                            <span className="font-semibold text-gray-900">Nrs. {metrics.grossRevenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-orange-50 text-orange-600 rounded-md">
                                    <Gift className="w-4 h-4" />
                                </div>
                                Promo Offers (Buy 1 Get 1, etc.)
                            </div>
                            <span className="font-semibold text-orange-600">- Nrs. {metrics.totalOffers.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-pink-50 text-pink-600 rounded-md">
                                    <Heart className="w-4 h-4" />
                                </div>
                                Complimentary Items
                            </div>
                            <span className="font-semibold text-pink-600">- Nrs. {metrics.totalComplimentary.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                                    <Gift className="w-4 h-4" />
                                </div>
                                Loyalty Redeemed
                            </div>
                            <span className="font-semibold text-emerald-600">- Nrs. {metrics.totalLoyalty.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
                                    <Percent className="w-4 h-4" />
                                </div>
                                Direct Discounts
                            </div>
                            <span className="font-semibold text-purple-600">- Nrs. {metrics.totalDiscounts.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-slate-100 text-slate-500 rounded-md">
                                    <Package className="w-4 h-4" />
                                </div>
                                Cost of Goods Sold (COGS)
                            </div>
                            <span className="font-semibold text-slate-500">- Nrs. {Math.round(metrics.totalCOGS).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-red-50 text-red-600 rounded-md">
                                    <Receipt className="w-4 h-4" />
                                </div>
                                Shop Expenses
                            </div>
                            <span className="font-semibold text-red-600">- Nrs. {metrics.totalExpenses.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-1">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-md">
                                    <FlaskConical className="w-4 h-4" />
                                </div>
                                Waste & Spillage (Loss)
                            </div>
                            <span className="font-semibold text-rose-600">- Nrs. {metrics.wasteValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-1">
                            <div className="flex items-center gap-2 text-gray-600">
                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                                Over-yield (Gain)
                            </div>
                            <span className="font-semibold text-emerald-600 font-black">+ Nrs. {metrics.overYieldValue.toLocaleString()}</span>
                        </div>
                        <div className="pt-3 border-t border-dashed border-gray-100 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-base font-bold text-gray-900">Actual Net Profit</span>
                                <span className="text-[10px] text-gray-400 font-medium">Reconciled Financial Truth</span>
                            </div>
                            <span className="text-lg font-bold text-purple-600">Nrs. {Math.round(metrics.totalRevenue - metrics.totalCOGS - metrics.totalExpenses - metrics.wasteValue + metrics.overYieldValue).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Insights */}
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-200/60 p-8 shadow-2xl border">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 font-['DM_Sans',sans-serif]">Liquidity Distribution</h3>
                    <div className="h-full flex flex-col justify-center">
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Cash</span>
                                    <span>{metrics.totalRevenue > 0 ? Math.round((metrics.cashTotal / metrics.totalRevenue) * 100) : 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${metrics.totalRevenue > 0 ? (metrics.cashTotal / metrics.totalRevenue) * 100 : 0}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
                                    <Wallet className="w-5 h-5 text-emerald-500" />
                                    Nrs. {metrics.cashTotal.toLocaleString()}
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>Card / Digital</span>
                                    <span>{metrics.totalRevenue > 0 ? Math.round((metrics.cardTotal / metrics.totalRevenue) * 100) : 0}%</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 transition-all duration-500"
                                        style={{ width: `${metrics.totalRevenue > 0 ? (metrics.cardTotal / metrics.totalRevenue) * 100 : 0}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
                                    <CreditCard className="w-5 h-5 text-purple-500" />
                                    Nrs. {metrics.cardTotal.toLocaleString()}
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-center text-gray-400 bg-gray-50 py-2 rounded-lg italic">
                            Split payments are automatically calculated into their respective cash/card buckets.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                    <RevenueChart data={revenueData} days={days} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <TopProductsCard
                    title="Product Analytics Board"
                    products={topProducts}
                />
                <RecentOrdersCard
                    title="Recent Transactions"
                    orders={recentOrders}
                />
            </div>
        </div>
    );
}
