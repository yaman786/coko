import { useQuery } from '@tanstack/react-query';
import { wholesaleApi } from '../../services/wholesaleApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Warehouse, TrendingUp, Users, Package } from 'lucide-react';

export function WholesaleDashboard() {
    usePageTitle('GOD Dashboard', 'GOD');

    const { data: statsData, isLoading, error } = useQuery({
        queryKey: ['ws_dashboard_stats'],
        queryFn: () => wholesaleApi.getDashboardStats(),
        refetchInterval: 30000, // Refresh every 30s
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
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

            <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm min-h-[400px] flex items-center justify-center rounded-2xl">
                <div className="text-center space-y-3 p-12">
                    <div className="w-20 h-20 bg-sky-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-sky-100/50">
                        <Warehouse className="w-10 h-10 text-sky-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 font-['DM_Sans',sans-serif] tracking-tight">Warehouse Operations</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                        Bulk inventory tracking and automated client ledgers are being initialized. Your supply chain management suite will be ready shortly.
                    </p>
                </div>
            </Card>
        </div>
    );
}

export default WholesaleDashboard;
