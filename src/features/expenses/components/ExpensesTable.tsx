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
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">{periodLabel}</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                            Nrs. {filteredTotal.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                        {(['today', 'week', 'month', 'all'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => { setPeriod(p); setCurrentPage(1); }}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    period === p 
                                    ? 'bg-white text-purple-700 shadow-sm border border-gray-200' 
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="pl-10 h-10"
                            />
                        </div>

                        <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger className="w-full lg:w-40 h-10">
                                <Filter className="w-4 h-4 mr-2 text-gray-400" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {['Rent', 'Salary', 'Inventory', 'Utilities', 'Marketing', 'Maintenance', 'Other'].map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button 
                            onClick={() => {
                                setEditingExpense(null);
                                setIsAddDialogOpen(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-10"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Record
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <Table containerClassName="max-h-[600px] overflow-y-auto">
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="font-bold">Date</TableHead>
                            <TableHead className="font-bold">Category</TableHead>
                            <TableHead className="font-bold">Description</TableHead>
                            <TableHead className="font-bold">Recorded By</TableHead>
                            <TableHead className="font-bold text-right">Amount</TableHead>
                            <TableHead className="text-right font-bold">Actions</TableHead>
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
                                <TableRow key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="font-medium">{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
                                    <TableCell>
                                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 uppercase tracking-tighter">
                                            {expense.category}
                                        </span>
                                    </TableCell>
                                    <TableCell className="max-w-[300px] truncate text-gray-600">{expense.description || '-'}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-gray-700">{expense.cashier_name || 'System'}</span>
                                            <span className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{expense.payment_method}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-red-600">Nrs. {Number(expense.amount).toLocaleString()}</TableCell>
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
