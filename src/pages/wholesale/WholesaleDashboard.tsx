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
            color: 'text-blue-600' 
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
            color: 'text-indigo-600' 
        },
        { 
            label: 'Bulk Stock Level', 
            value: statsData ? `${Math.min(100, Math.round((statsData.totalVolume / 5000) * 100))}%` : '...', 
            icon: Package, 
            color: 'text-blue-500' 
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-800">
                    Welcome to <span className="text-blue-600">GOD HUB</span>
                </h1>
                <p className="text-slate-500 font-medium">Wholesale Distribution & Logistics Overview</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                {stat.label}
                            </CardTitle>
                            <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-0 shadow-sm min-h-[400px] flex items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200">
                <div className="text-center space-y-2 p-12">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Warehouse className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Warehouse Operations Coming Soon</h3>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">
                        In the next step, we will implement the Bulk Inventory and Client Ledger systems for your wholesale business.
                    </p>
                </div>
            </Card>
        </div>
    );
}

export default WholesaleDashboard;
