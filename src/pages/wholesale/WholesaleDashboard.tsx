import { useQuery } from '@tanstack/react-query';
import { wholesaleApi } from '../../services/wholesaleApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Warehouse, TrendingUp, Users, Package, Receipt, ArrowRight, History, ArrowDownLeft, Clock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { api } from '../../services/api';

export function WholesaleDashboard() {
    usePageTitle('GOD Dashboard', 'GOD');

    const { data: statsData, isLoading: statsLoading, error } = useQuery({
        queryKey: ['ws_dashboard_stats'],
        queryFn: () => wholesaleApi.getDashboardStats(),
        refetchInterval: 30000,
    });

    const { data: recentOrders = [], isLoading: ordersLoading } = useQuery({
        queryKey: ['ws_orders_recent'],
        queryFn: () => wholesaleApi.getOrders(),
        select: (data) => data.slice(0, 5)
    });

    const { data: recentLogs = [], isLoading: logsLoading } = useQuery({
        queryKey: ['ws_audit_recent'],
        queryFn: () => api.getAuditLog(10, 'wholesale'),
    });

    if (error) {
        return (
            <div className="flex items-center justify-center h-[400px] text-red-500 font-medium">
                Failed to load dashboard statistics.
            </div>
        );
    }

    const stats = [
        {
            label: 'Total Supply Volume', 
            value: statsData ? `${statsData.totalVolume.toLocaleString()} Ltrs` : '...', 
            icon: Warehouse, 
            color: 'text-sky-600' 
        },
        { 
            label: 'Outstanding Credits', 
            value: statsData ? `Rs. ${statsData.totalCredits.toLocaleString()}` : '...', 
            icon: Users, 
            color: 'text-sky-600' 
        },
        { 
            label: 'Total Revenue', 
            value: statsData ? `Rs. ${statsData.totalRevenue.toLocaleString()}` : '...', 
            icon: TrendingUp, 
            color: 'text-sky-600' 
        },
        { 
            label: 'Bulk Stock Level', 
            value: statsData ? `${Math.min(100, Math.round((statsData.totalVolume / 5000) * 100))}%` : '...', 
            icon: Package, 
            color: 'text-sky-600' 
        },
    ];

    if (statsLoading || ordersLoading || logsLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
                <p className="text-slate-500 font-medium animate-pulse">Initializing GOD HUB intelligence...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">
                    Welcome to <span className="text-sky-600">GOD HUB</span>
                </h1>
                <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif]">Wholesale Distribution & Logistics Overview</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all duration-300 rounded-2xl">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">
                                {stat.label}
                            </CardTitle>
                            <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif]">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Supply Orders */}
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between p-8 pb-4 border-b border-slate-50">
                        <div>
                            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">Recent Supply Orders</CardTitle>
                            <p className="text-sm font-medium text-slate-500 mt-1">Latest movements in your supply chain</p>
                        </div>
                        <Link to="/wholesale/orders">
                            <Button variant="ghost" size="sm" className="text-sky-600 font-bold hover:bg-sky-50 rounded-xl">
                                View All <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-50">
                            {recentOrders.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="font-semibold">No orders found</p>
                                </div>
                            ) : (
                                recentOrders.map((order: any) => (
                                    <div key={order.id} className="p-6 hover:bg-sky-50/30 transition-colors flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
                                                <Receipt className="w-5 h-5 text-sky-600" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 tracking-tight">{order.order_number}</p>
                                                <p className="text-xs text-slate-400 font-medium">{order.client_name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-800">Rs. {order.total_amount.toLocaleString()}</p>
                                            <Badge variant="outline" className={`text-[9px] font-black uppercase mt-1 ${
                                                order.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                order.payment_status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                'bg-rose-50 text-rose-700 border-rose-100'
                                            }`}>
                                                {order.payment_status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Global Activity Feed */}
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between p-8 pb-4 border-b border-slate-50">
                        <div>
                            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">System History</CardTitle>
                            <p className="text-sm font-medium text-slate-500 mt-1">Audit trail of global operations</p>
                        </div>
                        <Link to="/wholesale/settings">
                            <Button variant="ghost" size="sm" className="text-sky-600 font-bold hover:bg-sky-50 rounded-xl">
                                Full Log <History className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-50">
                            {recentLogs.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="font-semibold">No activity recorded</p>
                                </div>
                            ) : (
                                recentLogs.slice(0, 5).map((log: any) => (
                                    <div key={log.id} className="p-6 hover:bg-sky-50/30 transition-colors flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            log.category === 'POS' ? 'bg-sky-100 text-sky-600' :
                                            log.category === 'INVENTORY' ? 'bg-emerald-100 text-emerald-600' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {log.category === 'POS' ? <ArrowDownLeft className="w-5 h-5" /> : 
                                             log.category === 'INVENTORY' ? <Package className="w-5 h-5" /> : 
                                             <Clock className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-slate-800 leading-snug truncate">{log.description}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(log.createdAt), 'h:mm a')}</span>
                                                <span className="text-[10px] text-slate-300">•</span>
                                                <span className="text-[10px] font-bold text-sky-600/70 uppercase tracking-wider">{log.actor_name || 'System'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default WholesaleDashboard;
