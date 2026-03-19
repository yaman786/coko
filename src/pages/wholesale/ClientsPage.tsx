import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wholesaleApi } from '../../services/wholesaleApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Users, Plus, Search, Phone, MapPin, DollarSign } from 'lucide-react';
import { AddWsClientDialog } from '../../features/wholesale/components/AddWsClientDialog';
import { ClientDetailSheet } from '../../features/wholesale/components/ClientDetailSheet';
import type { WsClient } from '../../types';

export function ClientsPage() {
    usePageTitle('Client Ledger', 'GOD');
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<WsClient | null>(null);
    const [selectedClient, setSelectedClient] = useState<WsClient | null>(null);

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['ws_clients'],
        queryFn: wholesaleApi.getClients,
    });

    const filteredClients = useMemo(() =>
        clients.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.address?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [clients, searchQuery]
    );

    const totalOutstanding = useMemo(() =>
        clients.reduce((sum, c) => sum + Math.max(0, c.balance), 0),
        [clients]
    );

    const handleAdd = () => {
        setEditingClient(null);
        setDialogOpen(true);
    };

    const handleEdit = (client: WsClient) => {
        setEditingClient(client);
        setDialogOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800">
                        Client <span className="text-blue-600">Ledger</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Manage cafes, restaurants & their balances</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Client
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Clients</CardTitle>
                        <Users className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{clients.length}</div>
                    </CardContent>
                </Card>
                <Card className={`border-0 shadow-sm ${totalOutstanding > 0 ? 'ring-2 ring-amber-200' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Outstanding</CardTitle>
                        <DollarSign className={`w-4 h-4 ${totalOutstanding > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            Rs. {totalOutstanding.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Clear Balance</CardTitle>
                        <Users className="w-4 h-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {clients.filter(c => c.balance <= 0).length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-white"
                />
            </div>

            {/* Client Cards Grid */}
            {filteredClients.length === 0 ? (
                <Card className="border-0 shadow-sm">
                    <CardContent className="py-16 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="font-semibold">No clients yet</p>
                        <p className="text-sm mt-1">Click "Add Client" to add your first cafe or restaurant</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClients.map((client) => (
                        <Card
                            key={client.id}
                            className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => setSelectedClient(client)}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                            {client.name}
                                        </h3>
                                        {client.contact_person && (
                                            <p className="text-sm text-slate-500 mt-0.5">{client.contact_person}</p>
                                        )}
                                    </div>
                                    <div className={`text-right ${client.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                        <p className="text-xs font-semibold uppercase text-slate-400">Balance</p>
                                        <p className="text-lg font-bold">
                                            Rs. {Math.abs(client.balance).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5 text-xs text-slate-500">
                                    {client.phone && (
                                        <div className="flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5" />
                                            <span>{client.phone}</span>
                                        </div>
                                    )}
                                    {client.address && (
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span className="truncate">{client.address}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <AddWsClientDialog
                open={dialogOpen}
                onClose={() => { setDialogOpen(false); setEditingClient(null); }}
                editingClient={editingClient}
            />

            {/* Client Detail Sheet */}
            {selectedClient && (
                <ClientDetailSheet
                    client={selectedClient}
                    onClose={() => setSelectedClient(null)}
                    onEdit={() => {
                        handleEdit(selectedClient);
                        setSelectedClient(null);
                    }}
                />
            )}
        </div>
    );
}

export default ClientsPage;
