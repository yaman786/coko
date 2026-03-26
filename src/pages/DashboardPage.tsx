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
import { Activity, DollarSign, Package, TrendingUp, ShieldAlert, RefreshCw, Globe, Loader2, Download, FileText, TableProperties, Gift, Heart, Percent, CreditCard, Wallet, Receipt, FlaskConical } from 'lucide-react';
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

    // 1. Concurrent and Cached Data Fetching — ALL queries use the `dateFilter` period
    const { data: metrics, isLoading: metricsLoading } = useQuery({
        queryKey: ['dashboardMetrics', queryKeyDatePart],
        queryFn: () => {
            console.log('[Query] Fetching metrics for:', dateFilter);
            return getDashboardMetrics(dateFilter);
        },
        staleTime: 1000 * 60 * 2, // 2 minutes
    });

    const { data: revenueData = [] } = useQuery({
        queryKey: ['revenueTrend', queryKeyDatePart],
        queryFn: () => {
            console.log('[Query] Fetching revenue trend for:', dateFilter);
            return getRevenueTrend(dateFilter);
        },
    });

    const { data: topProducts = [] } = useQuery({
        queryKey: ['topProducts', queryKeyDatePart],
        queryFn: () => getTopProducts(5, dateFilter),
    });

    const { data: recentOrders = [] } = useQuery({
        queryKey: ['recentOrders'],
        queryFn: () => getRecentOrders(10),
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
        <div className="flex-1 space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                        <p className="text-gray-500 text-sm hidden sm:block">Overview of your store's performance (Live)</p>
                    </div>

                    <div className="mt-0.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] md:text-xs font-semibold shadow-sm bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <Globe className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        Online
                    </div>
                </div>

                <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 md:px-4 py-2 text-xs md:text-sm font-medium rounded-md capitalize transition-colors min-h-[36px] md:min-h-[40px] ${period === p
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                    {period === 'custom' && (
                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm">
                            <input
                                type="date"
                                value={customFrom}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="text-xs md:text-sm border-0 bg-transparent text-gray-700 focus:outline-none"
                            />
                            <span className="text-gray-400 text-xs">to</span>
                            <input
                                type="date"
                                value={customTo}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="text-xs md:text-sm border-0 bg-transparent text-gray-700 focus:outline-none"
                            />
                        </div>
                    )}

                    {/* Export Dropdown */}
                    <div className="ml-1">
                        <DropdownMenu
                            buttonContent={
                                <>
                                    <Download className="w-4 h-4 text-purple-600" />
                                    <span className="hidden sm:inline">Export</span>
                                </>
                            }
                            buttonClassName="border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 h-[36px] md:h-[40px]"
                            items={[
                                {
                                    label: 'Export as PDF (Report)',
                                    icon: FileText,
                                    onClick: handleExportPDF
                                },
                                {
                                    label: 'Export as CSV (Data)',
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Financial Breakdown */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Financial Breakdown</h3>
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
                            <span className="text-lg font-bold text-purple-600">Nrs. {(metrics.totalRevenue - metrics.totalExpenses - metrics.wasteValue + metrics.overYieldValue).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Insights */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Payment Insights</h3>
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
