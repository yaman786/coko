import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Plus, Trash2, Edit2, Search, Calendar, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
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

    const { data: expenses = [], isLoading } = useQuery({
        queryKey: ['expenses'],
        queryFn: () => api.getExpenses()
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.deleteExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center shadow-inner">
                        <Calendar className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">{periodLabel}</p>
                        <p className="text-4xl font-black text-slate-900 tracking-tighter font-['DM_Sans',sans-serif] mt-1">
                            Nrs. {filteredTotal.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 bg-transparent">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-1.5 bg-white/80 backdrop-blur-xl p-1.5 rounded-xl border border-slate-200/60 shadow-sm transition-all duration-300">
                        {(['today', 'week', 'month', 'all'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => { setPeriod(p); setCurrentPage(1); }}
                                className={`px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-[0.1em] font-['DM_Sans',sans-serif] transition-all duration-300 ${
                                    period === p 
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' 
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 bg-transparent'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="pl-11 h-12 bg-white/50 backdrop-blur-sm border-slate-200/60 rounded-full focus:ring-2 focus:ring-purple-500/20 font-medium font-['DM_Sans',sans-serif]"
                            />
                        </div>

                        <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger className="w-full lg:w-48 h-12 rounded-full border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-bold font-['DM_Sans',sans-serif] text-slate-600 focus:ring-2 focus:ring-purple-500/20">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-200 bg-white/95 backdrop-blur-xl">
                                <SelectItem value="all" className="font-medium">All Categories</SelectItem>
                                {['Rent', 'Salary', 'Inventory', 'Utilities', 'Marketing', 'Maintenance', 'Other'].map(cat => (
                                    <SelectItem key={cat} value={cat} className="font-medium">{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button 
                            onClick={() => {
                                setEditingExpense(null);
                                setIsAddDialogOpen(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-12 px-6 rounded-full shadow-lg shadow-purple-500/20 hover:-translate-y-0.5 transition-all w-full lg:w-auto font-['DM_Sans',sans-serif]"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Record
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <Table containerClassName="max-h-[600px] overflow-y-auto">
                    <TableHeader>
                        <TableRow className="bg-slate-50/80 border-b border-slate-100">
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif] h-12">Date</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif] h-12">Category</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif] h-12">Description</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif] h-12">Recorded By</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif] text-right h-12">Amount</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif] text-right h-12">Actions</TableHead>
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
                                    <TableCell className="text-right text-base font-black text-rose-600 font-['DM_Sans',sans-serif]">Nrs. {Number(expense.amount).toLocaleString()}</TableCell>
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
                                        className={`h-8 w-8 p-0 text-xs ${currentPage === p ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
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
                    queryClient.invalidateQueries({ queryKey: ['expenses'] });
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
