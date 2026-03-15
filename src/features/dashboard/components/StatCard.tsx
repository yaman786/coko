import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<any>;
    description?: string;
    trend?: { value: number; isPositive: boolean };
    trendValue?: string;
}

export function StatCard({ title, value, icon: Icon, description, trend, trendValue }: StatCardProps) {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
                <div className="p-2 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg">
                    <Icon className="w-5 h-5 text-purple-600" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold font-sans text-slate-800">{value}</div>
                {(description || trend || trendValue) && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        {trend && trend.value !== 0 && (
                            <span className={`font-medium ${trend.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {trend.isPositive ? '↑' : '↓'} {trend.value}%
                            </span>
                        )}
                        {!trend && trendValue && <span className="text-slate-400 font-medium">- {trendValue}</span>}
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
