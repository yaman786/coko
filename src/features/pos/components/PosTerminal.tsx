import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Separator } from '../../../components/ui/separator';
import { Plus, Minus, Trash2, ShoppingBag, Loader2, Gift, Tag } from 'lucide-react';
import { api } from '../../../services/api';
import type { OrderItemPayload } from '../../../services/api';
import { usePosStore } from '../../../store/usePosStore';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { CreditCard, Banknote, SplitSquareHorizontal } from 'lucide-react';

export function PosTerminal() {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const { cart, addToCart, updateQuantity, setQuantity, removeFromCart, clearCart } = usePosStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    // 1. Robust Data Fetching with TanStack Query
    const { data: products = [], isLoading: productsLoading } = useQuery({
        queryKey: ['products'],
        queryFn: api.getProducts,
        select: (data) => data.filter(p => !p.isDeleted)
    });

    // Fetch store settings for dynamic tax rate
    const { data: storeSettings } = useQuery({
        queryKey: ['storeSettings'],
        queryFn: api.getStoreSettings,
        staleTime: 1000 * 60 * 5, // Cache for 5 min
    });
    const taxRate = (storeSettings?.taxRate ?? 0) / 100; // e.g. 13 → 0.13

    // 2. Atomic Checkout Mutation
    const checkoutMutation = useMutation({
        mutationFn: async (orderData: {
            id: string;
            items: OrderItemPayload[];
            totalAmount: number;
            subtotal: number;
            discount: number;
            loyalty: number;
            vat: number;
            paymentMethod: string;
            cashAmount: number;
            cardAmount: number;
            cashierId: string;
            cashierName: string;
            isComplimentary: boolean;
            complimentaryAmount?: number;
            offerTitle?: string;
            offerAmount?: number;
        }) => {
            return api.processOrder(orderData);
        },
        onSuccess: (_, variables) => {
            toast.success('Payment Processed', {
                description: `Order total: Nrs. ${variables.totalAmount.toFixed(2)}`
            });
            clearCart();
            setIsCheckoutModalOpen(false);
            setDiscountInput('0');
            setLoyaltyInput('0');
            setVatInput('0');
            setPaymentMethod('Cash');
            setCashAmountInput('');
            setCardAmountInput('');
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['recentOrders'] });

            // Audit Trail: Log successful checkout
            api.logActivity({
                action: 'ORDER_PLACED',
                category: 'POS',
                description: `Order #${variables.id.slice(0, 8)} — Nrs. ${variables.totalAmount.toFixed(2)} (${variables.items.length} items)`,
                metadata: { orderId: variables.id, total: variables.totalAmount, itemCount: variables.items.length },
                actor_email: variables.cashierId,
                actor_name: variables.cashierName,
            });
        },
        onError: (error) => {
            console.error("Checkout Failed:", error);
            toast.error('Checkout Failed', {
                description: "There was an error processing the order. Please try again."
            });
        },
        onSettled: () => {
            setIsCheckingOut(false);
        }
    });

    // Tender Engine State
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [discountInput, setDiscountInput] = useState<string>('0');
    const [loyaltyInput, setLoyaltyInput] = useState<string>('0');
    const [vatInput, setVatInput] = useState<string>('0');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Split'>('Cash');
    const [cashAmountInput, setCashAmountInput] = useState<string>('');
    const [cardAmountInput, setCardAmountInput] = useState<string>('');

    // Phase 12 & 13: Offers & Complimentary
    const [complimentaryAmountInput, setComplimentaryAmountInput] = useState('0');
    const [offerTitle, setOfferTitle] = useState('');
    const [offerAmountInput, setOfferAmountInput] = useState('0');

    // Derived Financials
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = parseFloat(discountInput) || 0;
    const loyaltyDeduction = parseFloat(loyaltyInput) || 0;
    const vatAmount = parseFloat(vatInput) || 0;
    const offerDeduction = parseFloat(offerAmountInput) || 0;
    const complimentaryDeduction = parseFloat(complimentaryAmountInput) || 0;

    const isComplimentary = complimentaryDeduction > 0;

    // Financial Hierarchy: Sub -> Disc -> Loy + Vat -> Offer -> Comp
    const grandTotal = Math.max(0, subtotal - discountAmount - loyaltyDeduction + vatAmount - offerDeduction - complimentaryDeduction);

    const cashTender = paymentMethod === 'Cash' ? grandTotal : paymentMethod === 'Split' ? (parseFloat(cashAmountInput) || 0) : 0;
    const cardTender = paymentMethod === 'Card' ? grandTotal : paymentMethod === 'Split' ? (parseFloat(cardAmountInput) || 0) : 0;
    const isSplitValid = paymentMethod !== 'Split' || (Math.abs((cashTender + cardTender) - grandTotal) < 0.01);

    const handleCheckoutInit = () => {
        if (cart.length === 0) return;

        // Stock validation: prevent overselling
        const outOfStockItems = cart.filter(cartItem => {
            const product = products.find(p => p.id === cartItem.id);
            return !product || product.stock < cartItem.quantity;
        });

        if (outOfStockItems.length > 0) {
            toast.error('Stock Insufficient', {
                description: `${outOfStockItems.map(i => i.name).join(', ')} — not enough stock.`
            });
            return;
        }

        setIsCheckoutModalOpen(true);
    };

    const handleFinalizeCheckout = async () => {
        if (cart.length === 0 || !isSplitValid) return;

        setIsCheckingOut(true);

        checkoutMutation.mutate({
            id: crypto.randomUUID(),
            items: cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                name: item.name,
                price: item.price
            })),
            totalAmount: grandTotal,
            subtotal: subtotal,
            discount: discountAmount,
            loyalty: loyaltyDeduction,
            vat: vatAmount,
            paymentMethod: isComplimentary ? 'Other' : paymentMethod,
            cashAmount: isComplimentary ? 0 : cashTender,
            cardAmount: isComplimentary ? 0 : cardTender,
            cashierId: session?.user.email || 'Unknown',
            cashierName: session?.user.email?.split('@')[0] || 'Unknown',
            isComplimentary,
            complimentaryAmount: complimentaryDeduction,
            offerTitle: offerTitle || undefined,
            offerAmount: offerDeduction
        });
    };

    const filteredItems = useMemo(() =>
        products.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [products, searchQuery]
    );

    const categories = useMemo(() =>
        Array.from(new Set(products.map(item => item.category))),
        [products]
    );

    if (productsLoading) {
        return (
            <div className="flex justify-center flex-col gap-4 items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <p className="text-gray-500 font-medium">Loading live menu...</p>
            </div>
        );
    }

    const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

    return (
        <div className="h-[calc(100vh-theme(spacing.20))] md:h-[calc(100vh-theme(spacing.16))] flex flex-col pt-6 pb-6 pr-6 pl-0 md:pl-6 -mt-6 md:mt-0 relative overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 h-full transition-all overflow-y-auto md:overflow-hidden pb-28 md:pb-0">
                <div className="md:col-span-7 xl:col-span-8 flex flex-col max-h-[55vh] md:max-h-none md:min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex-none bg-slate-50/50">
                        <Input
                            placeholder="Search menu items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-sm h-11 bg-white"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                        {filteredItems.length === 0 && searchQuery && (
                            <div className="flex flex-col items-center justify-center text-center p-8 h-full opacity-60">
                                <ShoppingBag className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-slate-500 font-semibold">No products found</p>
                                <p className="text-sm text-slate-400 mt-1 max-w-[200px]">Try searching for something else.</p>
                            </div>
                        )}
                        {categories.map(category => {
                            const categoryItems = filteredItems.filter(item => item.category === category);
                            if (categoryItems.length === 0) return null;

                            const subcategories = Array.from(new Set(categoryItems.map(i => i.subcategory || 'General')));

                            return (
                                <div key={category} className="mb-8 last:mb-0">
                                    <div className="flex items-center gap-2 mb-4">
                                        <h2 className="text-xl font-black text-slate-800 tracking-tight">{category}</h2>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-2 py-0 h-5">
                                            {categoryItems.length}
                                        </Badge>
                                    </div>
                                    {subcategories.map(subcat => {
                                        const subcatItems = categoryItems.filter(i => (i.subcategory || 'General') === subcat);
                                        return (
                                            <div key={`${category}-${subcat}`} className="mb-6 last:mb-0">
                                                {subcat !== 'General' && <h3 className="text-sm font-bold mb-3 text-slate-400 uppercase tracking-widest">{subcat}</h3>}
                                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                                                    {subcatItems.map(item => {
                                                        const isOutOfStock = item.stock <= 0;
                                                        const isLowStock = item.stock > 0 && item.stock <= 5;

                                                        return (
                                                            <Button
                                                                key={item.id}
                                                                variant="outline"
                                                                disabled={isOutOfStock}
                                                                className={`h-auto flex-col items-start p-3 md:p-4 transition-all active:scale-[0.98] shadow-sm text-left border-slate-200 group relative ${isOutOfStock
                                                                    ? 'bg-slate-50 opacity-60 cursor-not-allowed border-slate-100'
                                                                    : isLowStock
                                                                        ? 'bg-amber-50/30 hover:bg-amber-50 border-amber-200 hover:border-amber-300'
                                                                        : 'bg-white hover:bg-purple-50 hover:border-purple-300'
                                                                    }`}
                                                                onClick={() => !isOutOfStock && addToCart(item)}
                                                            >
                                                                {isOutOfStock && (
                                                                    <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Sold Out</span>
                                                                )}
                                                                {isLowStock && (
                                                                    <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2 text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{item.stock} left</span>
                                                                )}
                                                                <span className={`text-xs md:text-sm font-semibold leading-tight mb-1.5 md:mb-2 transition-colors text-wrap h-auto min-h-[1.5rem] md:min-h-[2.5rem] ${isOutOfStock ? 'text-slate-400' : 'text-slate-700 group-hover:text-purple-700'
                                                                    }`}>{item.name}</span>
                                                                <div className="flex items-center justify-between w-full mt-auto">
                                                                    <span className={`font-bold px-1.5 md:px-2 py-0.5 rounded text-[11px] md:text-xs transition-colors ${isOutOfStock
                                                                        ? 'bg-slate-100 text-slate-400'
                                                                        : 'text-purple-600 bg-purple-50 group-hover:bg-purple-100'
                                                                        }`}>Nrs. {item.price.toLocaleString()}</span>
                                                                </div>
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="md:col-span-5 xl:col-span-4 flex flex-col min-h-[200px] md:min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex-none bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <ShoppingBag className="w-4 h-4 text-purple-700" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 leading-none">Current Order</h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{cart.reduce((total, item) => total + item.quantity, 0)} items</p>
                            </div>
                        </div>
                        {cart.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearCart} className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 px-2">
                                Clear
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                                <ShoppingBag className="w-12 h-12 text-slate-300 mb-4" />
                                <p className="text-slate-500 font-semibold">Your cart is empty</p>
                                <p className="text-sm text-slate-400 mt-1 max-w-[200px]">Select items from the menu to start an order</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div key={item.id} className="flex flex-col gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-sm transition-all hover:border-purple-200">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 leading-tight">{item.name}</p>
                                                <p className="text-xs text-slate-500 mt-1 font-medium">Nrs. {item.price.toLocaleString()} each</p>
                                            </div>
                                            <div className="text-right flex-none">
                                                <p className="text-sm font-black text-purple-700">Nrs. {(item.price * item.quantity).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center bg-slate-100/80 rounded-lg border border-slate-200 h-9 p-0.5">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-full px-2.5 text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all rounded-md"
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </Button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity || ''}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        if (!isNaN(val) && val > 0) {
                                                            setQuantity(item.id, val);
                                                        } else if (e.target.value === '') {
                                                            setQuantity(item.id, 0);
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        if (!e.target.value || parseInt(e.target.value) < 1) {
                                                            setQuantity(item.id, 1);
                                                        }
                                                    }}
                                                    className="w-10 md:w-12 h-8 text-center text-sm font-black text-slate-700 bg-transparent border border-slate-200 rounded-md focus:ring-2 focus:ring-purple-500 hide-number-spinners mx-1"
                                                    style={{ MozAppearance: 'textfield' }}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-full px-2.5 text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all rounded-md"
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-9 w-9 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg border border-transparent hover:border-red-100 transition-all"
                                                onClick={() => removeFromCart(item.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 flex-none bg-white space-y-4">
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between text-slate-500 font-medium text-sm">
                                <span>Subtotal</span>
                                <span>Nrs. {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {taxRate > 0 && (
                                <div className="flex justify-between text-slate-500 font-medium text-sm">
                                    <span>Base VAT Suggestion ({(taxRate * 100).toFixed(0)}%)</span>
                                    <span>Nrs. {(subtotal * taxRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <Separator className="bg-slate-100 my-4" />
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Estimated Total</span>
                                <span className="text-purple-600 font-black text-3xl tracking-tight leading-none">Nrs. {(subtotal + (subtotal * taxRate)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <Button
                            className="w-full h-12 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-[0_4px_14px_0_rgba(147,51,234,0.39)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.23)] hover:-translate-y-0.5 transition-all mt-4 disabled:opacity-70 disabled:pointer-events-none hidden md:flex"
                            disabled={cart.length === 0}
                            onClick={handleCheckoutInit}
                        >
                            Open Tender Modal
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile sticky checkout bar — always visible at bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 font-medium">
                            {cartItemCount > 0 ? `${cartItemCount} item${cartItemCount > 1 ? 's' : ''} in cart` : 'Cart is empty'}
                        </p>
                        <p className="text-lg font-black text-slate-800 leading-tight">
                            Nrs. {(subtotal + (subtotal * taxRate)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <Button
                        className="h-11 px-6 text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-[0_4px_14px_0_rgba(147,51,234,0.39)] transition-all disabled:opacity-50 disabled:pointer-events-none rounded-xl"
                        disabled={cart.length === 0}
                        onClick={handleCheckoutInit}
                    >
                        Checkout
                    </Button>
                </div>
            </div>

            <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
                <DialogContent className="max-w-3xl w-full h-full md:h-auto md:w-[95vw] lg:max-w-3xl max-h-[100dvh] md:max-h-[85vh] p-0 bg-slate-50 flex flex-col gap-0 border-none shadow-2xl overflow-hidden [&>button]:top-4 [&>button]:right-4">
                    <DialogHeader className="p-4 md:p-6 pb-4 bg-white border-b border-slate-100 flex-none shrink-0 m-0">
                        <DialogTitle className="text-xl md:text-2xl font-black text-slate-800 pr-8">Complete Order</DialogTitle>
                        <DialogDescription className="text-xs md:text-sm">Review financials and select payment method.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0 bg-slate-50/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 min-h-max pb-8">
                            {/* Left Side: Financial Breakdown */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs mb-2 text-purple-600">Financial Breakdown</h3>

                                <div className="flex justify-between text-sm font-medium text-slate-600">
                                    <span>Subtotal</span>
                                    <span>Nrs. {subtotal.toLocaleString()}</span>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Discount (Nrs)</label>
                                    <Input type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} className="h-9 font-medium" />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Loyalty Deduction (Nrs)</label>
                                    <Input type="number" min="0" value={loyaltyInput} onChange={(e) => setLoyaltyInput(e.target.value)} className="h-9 font-medium" />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Vat / Taxes (Nrs) - Default {taxRate * 100}%</label>
                                    <Input type="number" min="0" value={vatInput} onChange={(e) => setVatInput(e.target.value)} className="h-9 font-medium bg-amber-50" />
                                </div>

                                <Separator className="my-2" />

                                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-purple-700">
                                                <Gift className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Complimentary (Nrs)</span>
                                            </div>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={complimentaryAmountInput}
                                                onChange={(e) => setComplimentaryAmountInput(e.target.value)}
                                                className="h-9 text-sm font-bold bg-white border-purple-200 focus-visible:ring-purple-500"
                                                placeholder="Enter amount..."
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-purple-700">
                                                <Tag className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Offer Title</span>
                                            </div>
                                            <Input
                                                placeholder="e.g. BOGO"
                                                value={offerTitle}
                                                onChange={(e) => setOfferTitle(e.target.value)}
                                                className="h-9 text-xs bg-white border-purple-200 focus-visible:ring-purple-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1 pt-1 border-t border-purple-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Offer Deduction (Nrs)</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={offerAmountInput}
                                                onChange={(e) => setOfferAmountInput(e.target.value)}
                                                className="h-8 w-24 text-xs bg-white border-purple-200 focus-visible:ring-purple-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-2" />

                                <div className="flex justify-between items-end">
                                    <span className="font-medium text-slate-500 uppercase tracking-widest text-xs">Grand Total</span>
                                    <span className="font-black text-3xl text-purple-700 tracking-tighter">Nrs. {grandTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Right Side: Tender Type */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs mb-2 text-purple-600">Payment Method</h3>

                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        variant={paymentMethod === 'Cash' ? 'default' : 'outline'}
                                        className={`h-16 flex-col gap-1 rounded-xl ${paymentMethod === 'Cash' ? 'bg-emerald-600 hover:bg-emerald-700 border-none' : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700'}`}
                                        onClick={() => setPaymentMethod('Cash')}
                                    >
                                        <Banknote className="w-5 h-5" />
                                        <span className="text-xs font-bold">Cash</span>
                                    </Button>
                                    <Button
                                        variant={paymentMethod === 'Card' ? 'default' : 'outline'}
                                        className={`h-16 flex-col gap-1 rounded-xl ${paymentMethod === 'Card' ? 'bg-blue-600 hover:bg-blue-700 border-none' : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-700'}`}
                                        onClick={() => setPaymentMethod('Card')}
                                    >
                                        <CreditCard className="w-5 h-5" />
                                        <span className="text-xs font-bold">Card</span>
                                    </Button>
                                    <Button
                                        variant={paymentMethod === 'Split' ? 'default' : 'outline'}
                                        className={`h-16 flex-col gap-1 rounded-xl ${paymentMethod === 'Split' ? 'bg-purple-600 hover:bg-purple-700 border-none' : 'border-slate-200 text-slate-500 hover:border-purple-300 hover:text-purple-700'}`}
                                        onClick={() => setPaymentMethod('Split')}
                                    >
                                        <SplitSquareHorizontal className="w-5 h-5" />
                                        <span className="text-xs font-bold">Split</span>
                                    </Button>
                                </div>

                                {paymentMethod === 'Split' && (
                                    <div className="space-y-3 pt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center justify-between">
                                                <span>Cash Amount</span>
                                                {cashTender > 0 && <span className="text-emerald-600">Nrs. {cashTender}</span>}
                                            </label>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="0.00"
                                                className="h-10 font-bold text-lg border-emerald-200 focus-visible:ring-emerald-500 bg-white"
                                                value={cashAmountInput}
                                                onChange={(e) => setCashAmountInput(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-blue-800 uppercase tracking-widest flex items-center justify-between">
                                                <span>Card Amount</span>
                                                {cardTender > 0 && <span className="text-blue-600">Nrs. {cardTender}</span>}
                                            </label>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="0.00"
                                                className="h-10 font-bold text-lg border-blue-200 focus-visible:ring-blue-500 bg-white"
                                                value={cardAmountInput}
                                                onChange={(e) => setCardAmountInput(e.target.value)}
                                            />
                                        </div>
                                        <div className={`mt-2 text-xs font-bold flex justify-between rounded p-2 ${isSplitValid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                            <span>Sum: Nrs. {cashTender + cardTender}</span>
                                            <span>Target: Nrs. {grandTotal}</span>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-4 md:p-6 pb-[env(safe-area-inset-bottom)] md:pb-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3 flex-none shrink-0 m-0 z-10 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)]">
                        <Button variant="ghost" className="w-full sm:w-auto font-semibold text-slate-500 hover:bg-slate-100" onClick={() => setIsCheckoutModalOpen(false)}>Cancel</Button>
                        <Button
                            className="w-full sm:w-auto h-11 px-8 font-black text-white bg-purple-600 hover:bg-purple-700 shadow-md transition-all shrink-0 min-w-[140px]"
                            disabled={!isSplitValid || isCheckingOut}
                            onClick={handleFinalizeCheckout}
                        >
                            {isCheckingOut ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {isCheckingOut ? 'Processing...' : 'Complete Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
