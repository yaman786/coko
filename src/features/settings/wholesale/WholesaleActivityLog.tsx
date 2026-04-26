
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { api } from '../../../services/api';
import { Loader2, ShoppingCart, Package, Users, Settings, Clock, Search, Filter } from 'lucide-react';
import type { AuditLogEntry } from '../../../types';

type CategoryFilter = AuditLogEntry['category'] | 'ALL';

const CATEGORY_CONFIG: Record<AuditLogEntry['category'], { icon: typeof ShoppingCart; color: string; bg: string; label: string }> = {
    POS: { icon: ShoppingCart, color: 'text-sky-700', bg: 'bg-sky-100', label: 'Wholesale' },
    INVENTORY: { icon: Package, color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Inventory' },
    STAFF: { icon: Users, color: 'text-blue-700', bg: 'bg-blue-100', label: 'Team' },
    SETTINGS: { icon: Settings, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Settings' },
};

const CATEGORY_FILTERS: { key: CategoryFilter; label: string; color: string; activeColor: string }[] = [
    { key: 'ALL', label: 'All', color: 'text-gray-600', activeColor: 'bg-gray-800 text-white' },
    { key: 'POS', label: 'Sales', color: 'text-sky-600', activeColor: 'bg-sky-600 text-white' },
    { key: 'INVENTORY', label: 'Inventory', color: 'text-emerald-600', activeColor: 'bg-emerald-600 text-white' },
    { key: 'STAFF', label: 'Team', color: 'text-blue-600', activeColor: 'bg-blue-600 text-white' },
    { key: 'SETTINGS', label: 'System', color: 'text-amber-600', activeColor: 'bg-amber-600 text-white' },
];

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function WholesaleActivityLog() {
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const currentPortal = 'wholesale';

    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['auditLog', currentPortal],
        queryFn: () => api.getAuditLog(100, currentPortal),
        refetchInterval: 30000,
    });

    const filteredLogs = useMemo(() => {
        return logs.filter((log: AuditLogEntry) => {
            if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                return (
                    log.description.toLowerCase().includes(q) ||
                    log.action.toLowerCase().includes(q) ||
                    (log.actor_name && log.actor_name.toLowerCase().includes(q))
                );
            }
            return true;
        });
    }, [logs, categoryFilter, searchQuery]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-64 items-center justify-center gap-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                <p className="text-slate-500 font-medium tracking-tight">Syncing activity feed...</p>
            </div>
        );
    }

    return (
        <Card className="border-0 shadow-md ring-1 ring-slate-200">
            <CardHeader className="bg-slate-50/50 rounded-t-xl border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <CardTitle className="text-xl text-slate-800">GOD Activity Log</CardTitle>
                        <CardDescription>Forensic trail of all wholesale movements.</CardDescription>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                        {CATEGORY_FILTERS.map(({ key, label, color, activeColor }) => (
                            <button
                                key={key}
                                onClick={() => setCategoryFilter(key)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${categoryFilter === key
                                        ? `${activeColor} shadow-sm`
                                        : `bg-white border border-slate-200 ${color} hover:border-slate-300 hover:shadow-sm`
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search wholesale actions..."
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-sm bg-white focus-visible:ring-sky-500"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <Clock className="w-8 h-8 text-slate-300" />
                        <p className="text-slate-500 font-medium text-sm">No wholesale events found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-[500px] overflow-auto">
                        {filteredLogs.map((log: AuditLogEntry) => {
                            const config = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.SETTINGS;
                            const Icon = config.icon;

                            return (
                                <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                                    <div className={`flex-shrink-0 p-2 rounded-lg ${config.bg}`}>
                                        <Icon className={`w-4 h-4 ${config.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0 h-4 ${config.color} border-current/20`}>
                                                {log.category}
                                            </Badge>
                                            <span className="text-xs text-slate-400">{log.action.replace(/_/g, ' ')}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 font-medium leading-snug">{log.description}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            by <span className="font-medium text-slate-500">{log.actor_name || 'System'}</span>
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                                            {formatTimeAgo(log.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
