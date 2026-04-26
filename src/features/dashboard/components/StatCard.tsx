import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<any>;
    description?: string;
    trend?: { value: number; isPositive: boolean };
    trendValue?: string;
    sparklineData?: { value: number }[]; // 10-point array for mini-chart
}

export function StatCard({ title, value, icon: Icon, description, trend, trendValue, sparklineData }: StatCardProps) {
    return (
        <Card className="group relative overflow-hidden border border-slate-200/60 bg-white/40 backdrop-blur-3xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 ease-out cursor-pointer rounded-[2rem] border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative z-10 px-6 pt-6">
                <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 font-['DM_Sans',sans-serif]">{title}</CardTitle>
                <div className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl group-hover:scale-110 transition-transform duration-300 border border-slate-200/40">
                    <Icon className="w-5 h-5 text-indigo-600" />
                </div>
            </CardHeader>
            <CardContent className="relative z-10 px-6 pb-6">
                <div className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif] mb-1">{value}</div>
                
                <div className="flex items-center justify-between">
                    {(description || trend || trendValue) && (
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                            {trend && trend.value !== 0 && (
                                <span className={`flex items-center font-bold px-1.5 py-0.5 rounded-md ${trend.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                    {trend.isPositive ? '↑' : '↓'} {trend.value}%
                                </span>
                            )}
                            {!trend && trendValue && <span className="text-slate-400">- {trendValue}</span>}
                            {description}
                        </p>
                    )}
                </div>
            </CardContent>

            {/* Premium Sparkline Background Injection */}
            {sparklineData && sparklineData.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`gradient-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#6366F1"
                                strokeWidth={2}
                                fill={`url(#gradient-${title.replace(/\s+/g, '')})`}
                                isAnimationActive={true}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
            
            {/* Liquid Glass Overlay Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl" />
        </Card>
    );
}
