import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Plus, Trash2, Edit2, Search, Filter, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { AddExpenseDialog } from './AddExpenseDialog';
import { toast } from 'sonner';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from '../../../components/ui/alert-dialog';
import type { Expense } from '../../../types';

export function ExpensesTable() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
    
    // Filters & Pagination
    const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 8;

    const isWholesale = typeof window !== 'undefined' && window.location.pathname.startsWith('/wholesale');
    const currentPortal = isWholesale ? 'wholesale' : 'retail';

    const { data: expenses = [], isLoading } = useQuery({
        queryKey: ['expenses', currentPortal],
        queryFn: () => api.getExpenses(undefined, undefined, currentPortal)
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', currentPortal] });
            queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
            toast.success('Expense deleted');
        }
    });

    const filteredExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        
        // 1. Period Filter
        let matchesPeriod = true;
        if (period === 'today') matchesPeriod = isToday(expDate);
        else if (period === 'week') matchesPeriod = isThisWeek(expDate);
        else if (period === 'month') matchesPeriod = isThisMonth(expDate);
        
        if (!matchesPeriod) return false;

        // 2. Category Filter
        if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;

        // 3. Search Filter
        const matchesSearch = 
            exp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exp.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesSearch;
    });

    // Pagination
    const totalPages = Math.ceil(filteredExpenses.length / pageSize);
    const paginatedExpenses = filteredExpenses.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const periodLabel = {
        today: "Today's Total",
        week: "This Week Total",
        month: "This Month Total",
        all: "All Time Total"
    }[period];

    const filteredTotal = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/40 backdrop-blur-3xl p-8 rounded-[2rem] border border-slate-200/60 shadow-2xl flex items-center gap-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group border">
                    <div className={`w-16 h-16 rounded-[1.25rem] bg-gradient-to-br ${isWholesale ? 'from-sky-500 to-blue-600' : 'from-rose-500 to-pink-600'} flex items-center justify-center shadow-lg shadow-rose-200/50 group-hover:scale-110 transition-transform`}>
                        <ShoppingBag className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-['DM_Sans',sans-serif]">{periodLabel}</p>
                        <p className="text-4xl font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif] mt-1">
                            Rs. {filteredTotal.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 bg-transparent">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-1.5 bg-white/50 backdrop-blur-md p-1.5 rounded-full border border-slate-200/60 shadow-inner transition-all duration-300">
                        {(['today', 'week', 'month', 'all'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => { setPeriod(p); setCurrentPage(1); }}
                                className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest font-['DM_Sans',sans-serif] transition-all duration-300 ${
                                    period === p 
                                    ? `${isWholesale ? 'bg-sky-600' : 'bg-purple-600'} text-white shadow-lg shadow-purple-500/20` 
                                    : 'text-slate-500 hover:text-slate-800 bg-transparent'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                                placeholder="Find spend..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className={`pl-12 h-12 bg-white/80 backdrop-blur-xl border-slate-200/60 rounded-full focus:ring-4 ${isWholesale ? 'focus:ring-sky-500/10' : 'focus:ring-purple-500/10'} font-['DM_Sans',sans-serif] shadow-sm text-sm transition-all`}
                            />
                        </div>

                        <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger className={`w-full lg:w-48 h-12 rounded-full border-slate-200/60 bg-white/80 backdrop-blur-xl text-[10px] font-black uppercase tracking-widest font-['DM_Sans',sans-serif] text-slate-500 focus:ring-4 ${isWholesale ? 'focus:ring-sky-500/10' : 'focus:ring-purple-500/10'} px-6`}>
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-2xl">
                                <SelectItem value="all" className="font-bold text-xs uppercase tracking-tight">All Domains</SelectItem>
                                {['Rent', 'Salary', 'Inventory', 'Utilities', 'Marketing', 'Maintenance', 'Other'].map(cat => (
                                    <SelectItem key={cat} value={cat} className="font-bold text-xs uppercase tracking-tight">{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button 
                            onClick={() => {
                                setEditingExpense(null);
                                setIsAddDialogOpen(true);
                            }}
                            className={`bg-gradient-to-r ${isWholesale ? 'from-sky-600 to-blue-600' : 'from-purple-600 to-indigo-600'} hover:shadow-xl hover:shadow-purple-500/20 text-white text-[10px] font-black uppercase tracking-widest h-12 px-8 rounded-full transition-all w-full lg:w-auto font-['DM_Sans',sans-serif]`}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Record
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white/40 backdrop-blur-3xl rounded-[2.5rem] border border-slate-200/60 shadow-2xl overflow-hidden border">
                <Table containerClassName="max-h-[600px] overflow-y-auto px-6">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="px-5 py-6 font-black text-slate-400 border-none uppercase tracking-[0.2em] text-[10px] font-['DM_Sans',sans-serif]">Timeline</TableHead>
                            <TableHead className="px-5 py-6 font-black text-slate-400 border-none uppercase tracking-[0.2em] text-[10px] font-['DM_Sans',sans-serif]">Domain</TableHead>
                            <TableHead className="px-5 py-6 font-black text-slate-400 border-none uppercase tracking-[0.2em] text-[10px] font-['DM_Sans',sans-serif]">Allocation Details</TableHead>
                            <TableHead className="px-5 py-6 font-black text-slate-400 border-none uppercase tracking-[0.2em] text-[10px] font-['DM_Sans',sans-serif]">Custodian</TableHead>
                            <TableHead className="px-5 py-6 font-black text-slate-400 border-none uppercase tracking-[0.2em] text-[10px] text-right font-['DM_Sans',sans-serif]">Amount</TableHead>
                            <TableHead className="px-5 py-6 font-black text-slate-400 border-none uppercase tracking-[0.2em] text-[10px] text-center w-[120px] font-['DM_Sans',sans-serif]">Audit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-gray-500">Loading expenses...</TableCell>
                            </TableRow>
                        ) : paginatedExpenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <Filter className="w-8 h-8 opacity-20" />
                                        <p>No expenses found for this selection.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedExpenses.map((expense) => (
                                <TableRow key={expense.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/50 last:border-0">
                                    <TableCell className="font-medium text-slate-600 font-['DM_Sans',sans-serif]">{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
                                    <TableCell>
                                        <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-[0.1em] font-['DM_Sans',sans-serif]">
                                            {expense.category}
                                        </span>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate text-slate-500 font-medium">{expense.description || '-'}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-bold text-slate-700">{expense.cashier_name || 'System'}</span>
                                            <span className="text-[10px] text-slate-400 font-bold tracking-[0.1em] uppercase font-['DM_Sans',sans-serif]">{expense.payment_method}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className={`text-right text-base font-black ${isWholesale ? 'text-sky-600' : 'text-rose-600'} font-['DM_Sans',sans-serif]`}>Nrs. {Number(expense.amount).toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingExpense(expense);
                                                    setIsAddDialogOpen(true);
                                                }}
                                                className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setExpenseToDelete(expense)}
                                                className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-slate-50/30">
                        <p className="text-sm text-gray-500 font-medium">
                            Showing <span className="text-gray-900">{((currentPage-1)*pageSize)+1}</span> to <span className="text-gray-900">{Math.min(currentPage*pageSize, filteredExpenses.length)}</span> of <span className="text-gray-900">{filteredExpenses.length}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                    <Button
                                        key={p}
                                        variant={currentPage === p ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setCurrentPage(p)}
                                        className={`h-8 w-8 p-0 text-xs ${currentPage === p ? (isWholesale ? 'bg-sky-600 hover:bg-sky-700' : 'bg-purple-600 hover:bg-purple-700') : ''}`}
                                    >
                                        {p}
                                    </Button>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="h-8 w-8 p-0"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <AddExpenseDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                editingExpense={editingExpense}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['expenses', currentPortal] });
                    queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
                }}
            />

            <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the expense of <span className="font-bold text-gray-900">Nrs. {Number(expenseToDelete?.amount || 0).toLocaleString()}</span> for <span className="font-bold text-gray-900">{expenseToDelete?.category}</span>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (expenseToDelete) {
                                    deleteMutation.mutate(expenseToDelete.id);
                                    setExpenseToDelete(null);
                                }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete Expense
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
