import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Trash2, 
  Calendar, 
  Clock,
  CreditCard, 
  ShoppingBag, 
  Loader2, 
  Plus, 
  Minus,
  Banknote,
  SplitSquareHorizontal,
  Gift
} from 'lucide-react';
import { api } from '../../../services/api';
import type { OrderItemPayload } from '../../../services/api';
import type { Product } from '../../../types';
import { usePosStore } from '../../../store/usePosStore';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Separator } from '../../../components/ui/separator';

export function PosTerminal() {
    const { session, role } = useAuth();
    const queryClient = useQueryClient();
    const { cart, addToCart, updateQuantity, setQuantity, removeFromCart, clearCart } = usePosStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [selectedParent, setSelectedParent] = useState<Product | null>(null);

    // 1. Robust Data Fetching with TanStack Query
    const { data: products = [], isLoading: productsLoading } = useQuery({
        queryKey: ['products', 'retail'],
        queryFn: () => api.getProducts('retail'),
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
            isWaste?: boolean;
            createdAt?: string;
        }) => {
            return api.processOrder(orderData);
        },
        onSuccess: (_, variables) => {
            toast.success(variables.isWaste ? 'Waste Logged' : 'Payment Processed', {
                description: variables.isWaste 
                    ? `Inventory deducted for ${variables.items.length} items.`
                    : `Order total: Nrs. ${variables.totalAmount.toFixed(2)}`
            });
            clearCart();
            setIsCheckoutModalOpen(false);
            setIsWaste(false);
            setOverrideDate(new Date().toISOString().split('T')[0]);
            setDiscountInput('0');
            setLoyaltyItemIds(new Set());
            setVatInput('0');
            setPaymentMethod('Cash');
            setCashAmountInput('');
            setCardAmountInput('');
            setComplimentaryAmountInput('0');
            setOfferTitle('');
            setOfferAmountInput('0');
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['recentOrders'] });

                // Audit Trail: Log successful checkout
                api.logActivity({
                    action: variables.isWaste ? 'WASTE_ENTRY' : 'ORDER_PLACED',
                    category: 'POS',
                    description: variables.isWaste
                        ? `Waste/Spillage Logged — ${variables.items.length} items deducted.`
                        : `Order #${variables.id.slice(0, 8)} — Nrs. ${variables.totalAmount.toFixed(2)} (${variables.items.length} items)`,
                    metadata: { orderId: variables.id, total: variables.totalAmount, itemCount: variables.items.length, isWaste: variables.isWaste },
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
    const [loyaltyItemIds, setLoyaltyItemIds] = useState<Set<string>>(new Set());
    const [vatInput, setVatInput] = useState<string>('0');
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Split'>('Cash');
    const [cashAmountInput, setCashAmountInput] = useState<string>('');
    const [cardAmountInput, setCardAmountInput] = useState<string>('');

    // Phase 12 & 13: Offers & Complimentary
    const [complimentaryAmountInput, setComplimentaryAmountInput] = useState('0');
    const [offerTitle, setOfferTitle] = useState('');
    const [offerAmountInput, setOfferAmountInput] = useState('0');

    // Phase 14: Admin Date & Time Override
    const [overrideDate, setOverrideDate] = useState<string>(() => {
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    });

    const [isWaste, setIsWaste] = useState(false);

    // Derived Financials
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = parseFloat(discountInput) || 0;
    // Loyalty deduction is now computed from the selected loyalty items
    const loyaltyDeduction = useMemo(() => {
        let total = 0;
        loyaltyItemIds.forEach(id => {
            const cartItem = cart.find(ci => ci.id === id);
            if (cartItem) total += cartItem.price; // 1 unit redeemed per selection
        });
        return total;
    }, [loyaltyItemIds, cart]);
    const vatAmount = parseFloat(vatInput) || 0;
    const offerDeduction = parseFloat(offerAmountInput) || 0;
    const complimentaryDeduction = parseFloat(complimentaryAmountInput) || 0;

    const isComplimentary = complimentaryDeduction > 0;

    // Financial Hierarchy: Sub -> Disc -> Loy + Vat -> Offer -> Comp
    const grandTotal = isWaste ? 0 : Math.max(0, subtotal - discountAmount - loyaltyDeduction + vatAmount - offerDeduction - complimentaryDeduction);

    const cashTender = paymentMethod === 'Cash' ? grandTotal : paymentMethod === 'Split' ? (parseFloat(cashAmountInput) || 0) : 0;
    const cardTender = paymentMethod === 'Card' ? grandTotal : paymentMethod === 'Split' ? (parseFloat(cardAmountInput) || 0) : 0;
    const isSplitValid = paymentMethod !== 'Split' || (Math.abs((cashTender + cardTender) - grandTotal) < 0.01);

    const handleCheckoutInit = () => {
        if (cart.length === 0) return;

        // 1. Group cart by ParentId to check total pool sufficiency
        const parentStockClaims: Record<string, number> = {};
        const standaloneStockClaims: Record<string, number> = {};

        cart.forEach(item => {
            const product = products.find(p => p.id === item.id);
            if (!product || product.trackInventory === false) return;

            if (product.parentId) {
                const consumption = item.quantity * (product.stockMultiplier || 1);
                parentStockClaims[product.parentId] = (parentStockClaims[product.parentId] || 0) + consumption;
            } else {
                standaloneStockClaims[item.id] = (standaloneStockClaims[item.id] || 0) + item.quantity;
            }
        });

        // 2. Validate Claims with safety buffer
        const outOfStockItems: string[] = [];
        const negativeWarningItems: string[] = [];

        // Check Standalone
        Object.entries(standaloneStockClaims).forEach(([id, qty]) => {
            const product = products.find(p => p.id === id);
            if (!product) return;
            
            const isScoop = product.category === 'Scoops';
            const safetyLimit = isScoop ? -10 : 0;
            const resultingStock = product.stock - qty;

            if (resultingStock < safetyLimit) {
                outOfStockItems.push(product.name);
            } else if (resultingStock < 0) {
                negativeWarningItems.push(product.name);
            }
        });

        // Check Parent Pools
        Object.entries(parentStockClaims).forEach(([parentId, qty]) => {
            const parent = products.find(p => p.id === parentId);
            if (!parent) return;

            const isScoop = parent.category === 'Scoops';
            const safetyLimit = isScoop ? -10 : 0;
            const resultingStock = parent.stock - qty;

            if (resultingStock < safetyLimit) {
                outOfStockItems.push(parent.name);
            } else if (resultingStock < 0) {
                negativeWarningItems.push(parent.name);
            }
        });

        if (outOfStockItems.length > 0) {
            toast.error('Stock Depleted', {
                description: `${outOfStockItems.join(', ')} — Standard limit reached. Please log restock.`
            });
            return;
        }

        if (negativeWarningItems.length > 0) {
            toast.warning('Selling Extra Yield', {
                description: `Negative stock for: ${negativeWarningItems.join(', ')}. Manager audit required later.`
            });
        }

        setIsCheckoutModalOpen(true);
    };

    const handleFinalizeCheckout = async () => {
        if (cart.length === 0 || !isSplitValid) return;

        setIsCheckingOut(true);

        checkoutMutation.mutate({
            id: crypto.randomUUID(),
            items: cart.map(item => {
                const product = products.find(p => p.id === item.id);
                let finalCost = item.costPrice || 0;

                if (product?.parentId) {
                    const parent = products.find(p => p.id === product.parentId);
                    if (parent) {
                        finalCost = (parent.costPrice || 0) * (product.stockMultiplier || 1);
                    }
                }

                return {
                    product_id: item.id,
                    quantity: item.quantity,
                    name: item.name,
                    price: item.price,
                    cost_price: finalCost
                };
            }),
            totalAmount: grandTotal,
            subtotal: subtotal,
            discount: discountAmount,
            loyalty: loyaltyDeduction,
            vat: vatAmount,
            paymentMethod: (isWaste || isComplimentary) ? 'Other' : paymentMethod,
            cashAmount: (isWaste || isComplimentary) ? 0 : cashTender,
            cardAmount: (isWaste || isComplimentary) ? 0 : cardTender,
            cashierId: session?.user.email || 'Unknown',
            cashierName: session?.user.email?.split('@')[0] || 'Unknown',
            isComplimentary,
            complimentaryAmount: complimentaryDeduction,
            offerTitle: offerTitle || undefined,
            offerAmount: offerDeduction,
            isWaste,
            createdAt: overrideDate === new Date().toISOString().split('T')[0] ? undefined : new Date(overrideDate).toISOString()
        });
    };

    const filteredItems = useMemo(() =>
        products.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            const isChild = !!item.parentId;
            return matchesSearch && !isChild;
        }),
        [products, searchQuery]
    );

    const CATEGORY_ORDER = [
        'Scoops',
        'BIO PRODUCT',
        'OTHERS',
        'DRINKS',
        'POPCORN'
    ];

    const SCOOPS_SUBCATEGORY_ORDER = [
        'Classic',
        'Exotic',
        'Signature',
        'Fantasy'
    ];

    const BIO_SUBCATEGORY_ORDER = [
        '100ML CUP',
        'BAR',
        '500ML',
        '1000ML'
    ];

    const categories = useMemo(() => {
        const uniqueCategories = Array.from(new Set(products.map(item => item.category || 'Others')));
        return uniqueCategories.sort((a, b) => {
            const getIndex = (name: string) => {
                const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return CATEGORY_ORDER.findIndex(o => {
                    const target = o.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return n.includes(target) || target.includes(n);
                });
            };
            
            const indexA = getIndex(a);
            const indexB = getIndex(b);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [products]);

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
                    <div className="p-4 flex-none bg-white border-b border-slate-100 z-10 sticky top-0">
                        <div className="relative">
                            <Input
                                placeholder="Search menu items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 bg-slate-50/60 backdrop-blur-md border-slate-200/60 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 rounded-full pl-11 shadow-sm font-['DM_Sans',sans-serif]"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ShoppingBag className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
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
                            const categoryItems = filteredItems.filter(item => (item.category || 'Others') === category);
                            if (categoryItems.length === 0) return null;

                            const renderProductCard = (item: Product) => {
                                const isScoop = item.category === 'Scoops';
                                const safetyLimit = isScoop ? -10 : 0;
                                const isOutOfStock = item.trackInventory !== false && item.stock <= safetyLimit;
                                const isLowStock = item.trackInventory !== false && item.stock > safetyLimit && item.stock <= 5;
                                const isParent = products.some(p => p.parentId === item.id);

                                const handleClick = () => {
                                    if (isOutOfStock) return;
                                    if (isParent) {
                                        setSelectedParent(item);
                                    } else {
                                        addToCart(item);
                                    }
                                };

                                return (
                                    <div
                                        key={item.id}
                                        role="button"
                                        aria-disabled={isOutOfStock}
                                        className={`flex flex-col h-full min-h-[110px] md:min-h-[130px] p-4 rounded-2xl transition-all duration-300 ease-out text-left relative group ${
                                            isOutOfStock
                                                ? 'bg-slate-50/50 opacity-50 cursor-not-allowed border border-slate-100/50'
                                                : isLowStock
                                                    ? 'bg-amber-50/30 hover:bg-amber-50 border border-amber-200 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                                                    : 'bg-white/90 backdrop-blur-xl border border-slate-200/60 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1 shadow-sm cursor-pointer'
                                        }`}
                                        onClick={handleClick}
                                    >
                                        <div className="flex-1">
                                            {isOutOfStock && (
                                                <span className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md font-['DM_Sans',sans-serif]">Sold Out</span>
                                            )}
                                            {isLowStock && (
                                                <span className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md font-['DM_Sans',sans-serif]">{item.stock} left</span>
                                            )}
                                            <h4 className={`text-sm md:text-[15px] font-bold leading-snug mb-2 transition-colors pr-10 font-['DM_Sans',sans-serif] ${
                                                isOutOfStock ? 'text-slate-400' : 'text-slate-800 group-hover:text-indigo-700'
                                            }`}>
                                                {item.name.replace(' (STOCK)', '')}
                                            </h4>
                                        </div>
                                        <div className="flex items-center justify-between w-full mt-auto pt-2">
                                            <span className={`font-black px-2.5 py-1 rounded-lg text-xs transition-colors ${
                                                isOutOfStock
                                                    ? 'bg-slate-100 text-slate-400'
                                                    : 'text-indigo-700 bg-indigo-50/80 group-hover:bg-indigo-100'
                                            } font-['DM_Sans',sans-serif]`}>
                                                {isParent ? 'Options' : `Nrs. ${item.price.toLocaleString()}`}
                                            </span>
                                            {!isOutOfStock && (
                                                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all group-hover:bg-indigo-600 duration-300 translate-x-2 group-hover:translate-x-0">
                                                    <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <div key={category} className="mb-8 last:mb-0">
                                    <div className="flex items-center gap-2 mb-4 mt-2">
                                        <h2 className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase font-['DM_Sans',sans-serif]">{category}</h2>
                                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-600/80 font-bold px-1.5 h-4 text-[10px]">
                                            {categoryItems.length}
                                        </Badge>
                                    </div>
                                    {['Scoops', 'Bio-products', 'DRINKS', 'Tea Babrage', 'Drinks'].includes(category) ? (
                                        <div className="space-y-6">
                                            {(() => {
                                                const groupsMap = new Map<string, Product[]>();
                                                categoryItems.forEach(item => {
                                                    const rawSub = item.subcategory?.trim() || `Other ${category}`;
                                                    const key = rawSub.toLowerCase();
                                                    if (!groupsMap.has(key)) groupsMap.set(key, []);
                                                    groupsMap.get(key)!.push(item);
                                                });

                                                const sortedEntries = Array.from(groupsMap.entries()).sort((a, b) => {
                                                    const subA = (a[1][0].subcategory?.trim() || '').toLowerCase();
                                                    const subB = (b[1][0].subcategory?.trim() || '').toLowerCase();
                                                    const getSubIndex = (name: string, orderList: string[]) => orderList.findIndex(o => name.includes(o.toLowerCase()));

                                                    if (category === 'Scoops') {
                                                        const idxA = getSubIndex(subA, SCOOPS_SUBCATEGORY_ORDER);
                                                        const idxB = getSubIndex(subB, SCOOPS_SUBCATEGORY_ORDER);
                                                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                        if (idxA !== -1) return -1;
                                                        if (idxB !== -1) return 1;
                                                    } else if (category.toLowerCase().includes('bio')) {
                                                        const idxA = getSubIndex(subA, BIO_SUBCATEGORY_ORDER);
                                                        const idxB = getSubIndex(subB, BIO_SUBCATEGORY_ORDER);
                                                        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                                        if (idxA !== -1) return -1;
                                                        if (idxB !== -1) return 1;
                                                    }
                                                    return a[0].localeCompare(b[0]);
                                                });

                                                return sortedEntries.map(([key, items]) => {
                                                    const displayHeader = items[0].subcategory?.trim() || `Other ${category}`;
                                                    if (category === 'Scoops') items.sort((a, b) => a.name.localeCompare(b.name));
                                                    return (
                                                        <div key={key}>
                                                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center mb-3">
                                                                <span className="bg-slate-100 px-3 py-1 rounded-md">{displayHeader}</span>
                                                            </h3>
                                                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                                                                {items.map(item => renderProductCard(item))}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                                            {categoryItems.map(item => renderProductCard(item))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="md:col-span-5 xl:col-span-4 flex flex-col min-h-[200px] md:min-h-0 bg-white/95 backdrop-blur-2xl rounded-xl shadow-[-5px_0_30px_-15px_rgba(0,0,0,0.1)] border-l border-indigo-50 overflow-hidden relative z-20">
                    <div className="p-4 border-b border-indigo-50/50 flex-none bg-indigo-50/30 flex items-center justify-between backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <ShoppingBag className="w-4 h-4 text-indigo-700" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 leading-none font-['DM_Sans',sans-serif]">Current Order</h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium font-['DM_Sans',sans-serif]">{cartItemCount} items</p>
                            </div>
                        </div>
                        {cart.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearCart} className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 px-2 font-['DM_Sans',sans-serif]">
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
                                    <div key={item.id} className="flex flex-col gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:border-indigo-200 hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)]">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 leading-tight font-['DM_Sans',sans-serif]">{item.name}</p>
                                                <p className="text-xs text-slate-500 mt-1 font-medium font-['DM_Sans',sans-serif]">Nrs. {item.price.toLocaleString()} each</p>
                                            </div>
                                            <div className="text-right flex-none">
                                                <p className="text-sm font-black text-indigo-700 font-['DM_Sans',sans-serif]">Nrs. {(item.price * item.quantity).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center bg-slate-100/80 rounded-lg border border-slate-200 h-9 p-0.5">
                                                <Button size="sm" variant="ghost" className="h-full px-2.5 text-slate-500 rounded-md" onClick={() => updateQuantity(item.id, -1)}>
                                                    <Minus className="w-3.5 h-3.5" />
                                                </Button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity || ''}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        if (!isNaN(val) && val > 0) setQuantity(item.id, val);
                                                        else if (e.target.value === '') setQuantity(item.id, 0);
                                                    }}
                                                    onBlur={(e) => {
                                                        if (!e.target.value || parseInt(e.target.value) < 1) setQuantity(item.id, 1);
                                                    }}
                                                    className="w-10 md:w-12 h-8 text-center text-sm font-black text-slate-700 bg-transparent border border-slate-200 rounded-md mx-1"
                                                />
                                                <Button size="sm" variant="ghost" className="h-full px-2.5 text-slate-500 rounded-md" onClick={() => updateQuantity(item.id, 1)}>
                                                    <Plus className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 rounded-lg" onClick={() => removeFromCart(item.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 flex-none bg-white/60 backdrop-blur-md space-y-4">
                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between text-slate-500 font-medium text-sm font-['DM_Sans',sans-serif]">
                                <span>Subtotal</span>
                                <span>Nrs. {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <Separator className="bg-slate-100 my-4" />
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest font-['DM_Sans',sans-serif]">Estimated Total</span>
                                <span className="text-indigo-600 font-black text-3xl tracking-tight leading-none font-['DM_Sans',sans-serif]">Nrs. {(subtotal + (subtotal * taxRate)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                        <Button className="w-full h-12 text-base font-bold font-['DM_Sans',sans-serif] bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 border-0 hover:scale-[1.02] transition-all duration-300 text-white shadow-xl shadow-indigo-500/25 mt-4 disabled:opacity-70 disabled:hover:scale-100 hidden md:flex" disabled={cart.length === 0} onClick={handleCheckoutInit}>
                            Open Tender Modal
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Checkout Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-2xl shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] border-t border-indigo-50 px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 font-medium font-['DM_Sans',sans-serif]">{cartItemCount} items</p>
                        <p className="text-lg font-black text-slate-800 leading-tight font-['DM_Sans',sans-serif]">Nrs. {(subtotal + (subtotal * taxRate)).toLocaleString()}</p>
                    </div>
                    <Button className="h-11 px-6 text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:scale-[1.02] shadow-lg shadow-indigo-500/20 border-0 transition-all rounded-xl text-white font-['DM_Sans',sans-serif]" disabled={cart.length === 0} onClick={handleCheckoutInit}>
                        Checkout
                    </Button>
                </div>
            </div>

            {/* Tender Modal */}
            <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
                <DialogContent className="max-w-3xl w-full h-full md:h-auto md:w-[95vw] lg:max-w-3xl max-h-[100dvh] md:max-h-[85vh] p-0 bg-slate-50 flex flex-col gap-0 border-none shadow-2xl overflow-hidden">
                    <DialogHeader className="p-4 md:p-6 pb-4 bg-white border-b border-slate-100 flex-none sticky top-0 z-20">
                        <DialogTitle className="text-xl md:text-2xl font-black text-slate-800">Complete Order</DialogTitle>
                        <DialogDescription className="text-xs md:text-sm">Review financials and finalize.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 min-h-max pb-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs mb-2 text-purple-600">Financial Details</h3>

                                {role?.toLowerCase() === 'admin' && (
                                    <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 shadow-sm mb-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-amber-700">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Historical Override</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 rounded-full text-[9px] font-bold text-amber-800 uppercase">
                                                <Clock className="w-3 h-3" /> Admin
                                            </div>
                                        </div>
                                        <Input type="datetime-local" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} className="h-10 text-sm font-bold bg-white border-amber-200 focus-visible:ring-amber-500 rounded-lg" />
                                    </div>
                                )}

                                <div className={`p-4 rounded-xl border transition-all mb-4 ${isWaste ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-slate-200'}`}>
                                    <Button
                                        variant={isWaste ? 'default' : 'outline'}
                                        onClick={() => {
                                            setIsWaste(!isWaste);
                                            if (!isWaste) {
                                                setDiscountInput('0');
                                                setLoyaltyItemIds(new Set());
                                                setVatInput('0');
                                                setComplimentaryAmountInput('0');
                                                setOfferAmountInput('0');
                                            }
                                        }}
                                        className={`w-full justify-between h-12 px-4 transition-all ${isWaste ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-600'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Trash2 className="w-5 h-5" />
                                            <span className="text-sm font-black uppercase tracking-widest">{isWaste ? 'Waste Mode Active' : 'Log as Waste/Spillage'}</span>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isWaste ? 'bg-white text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {isWaste ? '✓' : ''}
                                        </div>
                                    </Button>
                                    {isWaste && (
                                        <p className="text-[10px] text-red-600 mt-2 font-bold px-1 uppercase tracking-tight">⚠️ Standard stock deduction applies. No revenue.</p>
                                    )}
                                </div>

                                {!isWaste ? (
                                    <>
                                        <div className="flex justify-between text-sm font-medium text-slate-600 px-1">
                                            <span>Subtotal</span>
                                            <span>Nrs. {subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500">Discount (Nrs)</label>
                                            <Input type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} className="h-9 font-medium" />
                                        </div>
                                        {/* Item-Based Loyalty Redemption */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                                                    <Gift className="w-3.5 h-3.5 text-amber-500" />
                                                    Loyalty Redemption
                                                </label>
                                                {loyaltyDeduction > 0 && (
                                                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                        -Nrs. {loyaltyDeduction.toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            {(() => {
                                                const eligibleItems = cart.filter(ci => {
                                                    const product = products.find(p => p.id === ci.id);
                                                    if (!product) return false;
                                                    // Check if this specific product is loyalty eligible
                                                    if (product.isLoyaltyEligible) return true;
                                                    // Check if its parent is loyalty eligible (for child variants)
                                                    if (product.parentId) {
                                                        const parent = products.find(p => p.id === product.parentId);
                                                        if (parent?.isLoyaltyEligible) return true;
                                                    }
                                                    return false;
                                                });
                                                if (eligibleItems.length === 0) {
                                                    return (
                                                        <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No loyalty-eligible items in cart</p>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div className="space-y-1.5">
                                                        {eligibleItems.map(ci => {
                                                            const isSelected = loyaltyItemIds.has(ci.id);
                                                            return (
                                                                <button
                                                                    key={ci.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const next = new Set(loyaltyItemIds);
                                                                        if (isSelected) next.delete(ci.id);
                                                                        else next.add(ci.id);
                                                                        setLoyaltyItemIds(next);
                                                                    }}
                                                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${
                                                                        isSelected
                                                                            ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200'
                                                                            : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                                                            isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white'
                                                                        }`}>
                                                                            {isSelected && <span className="text-xs font-black">✓</span>}
                                                                        </div>
                                                                        <span className={`text-xs font-bold ${isSelected ? 'text-amber-800' : 'text-slate-600'}`}>{ci.name}</span>
                                                                    </div>
                                                                    <span className={`text-xs font-black ${isSelected ? 'text-amber-600 line-through' : 'text-slate-500'}`}>
                                                                        Nrs. {ci.price.toLocaleString()}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500">Vat / Taxes (Nrs)</label>
                                            <Input type="number" min="0" value={vatInput} onChange={(e) => setVatInput(e.target.value)} className="h-9 font-medium bg-amber-50" />
                                        </div>
                                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-purple-700 uppercase">Complimentary</label>
                                                <Input type="number" min="0" value={complimentaryAmountInput} onChange={(e) => setComplimentaryAmountInput(e.target.value)} className="h-9 text-sm font-bold bg-white" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-purple-700 uppercase">Offer Title</label>
                                                <Input placeholder="BOGO" value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} className="h-9 text-xs bg-white" />
                                            </div>
                                            <div className="col-span-2 space-y-1 pt-1 border-t border-purple-100">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Offer Amount</label>
                                                    <Input type="number" min="0" value={offerAmountInput} onChange={(e) => setOfferAmountInput(e.target.value)} className="h-8 w-24 text-xs bg-white" />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 bg-slate-100/50 rounded-xl border border-dashed border-slate-200 text-center">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sale Fields Hidden</p>
                                    </div>
                                )}

                                <Separator />

                                <div className="flex justify-between items-end mt-2 px-1">
                                    <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">{isWaste ? 'Wasted Value' : 'Grand Total'}</span>
                                    <span className={`font-black text-3xl tracking-tighter ${isWaste ? 'text-red-600' : 'text-purple-700'}`}>
                                        Nrs. {isWaste ? subtotal.toLocaleString() : grandTotal.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {isWaste ? (
                                    <div className="p-8 bg-white rounded-3xl border-2 border-red-100 flex flex-col items-center justify-center text-center space-y-6 h-full shadow-sm">
                                        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center relative">
                                            <Trash2 className="w-10 h-10 text-red-600 relative z-10" />
                                            <div className="absolute inset-0 bg-red-200 rounded-full animate-ping opacity-20"></div>
                                        </div>
                                        <div className="space-y-2">
                                            <h4 className="text-xl font-black text-red-700 uppercase tracking-tighter">Waste Logging</h4>
                                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                                Deducting <span className="text-red-600 font-bold">{cartItemCount} units</span> from inventory.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-slate-700 uppercase tracking-widest text-xs mb-2 text-purple-600">Payment</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                            <Button variant={paymentMethod === 'Cash' ? 'default' : 'outline'} className={`h-16 flex-col gap-1 rounded-xl ${paymentMethod === 'Cash' ? 'bg-emerald-600 hover:bg-emerald-700 border-none text-white' : ''}`} onClick={() => setPaymentMethod('Cash')}>
                                                <Banknote className="w-5 h-5" /> <span className="text-xs font-bold">Cash</span>
                                            </Button>
                                            <Button variant={paymentMethod === 'Card' ? 'default' : 'outline'} className={`h-16 flex-col gap-1 rounded-xl ${paymentMethod === 'Card' ? 'bg-blue-600 hover:bg-blue-700 border-none text-white' : ''}`} onClick={() => setPaymentMethod('Card')}>
                                                <CreditCard className="w-5 h-5" /> <span className="text-xs font-bold">Card</span>
                                            </Button>
                                            <Button variant={paymentMethod === 'Split' ? 'default' : 'outline'} className={`h-16 flex-col gap-1 rounded-xl ${paymentMethod === 'Split' ? 'bg-purple-600 hover:bg-purple-700 border-none text-white' : ''}`} onClick={() => setPaymentMethod('Split')}>
                                                <SplitSquareHorizontal className="w-5 h-5" /> <span className="text-xs font-bold">Split</span>
                                            </Button>
                                        </div>
                                        {paymentMethod === 'Split' && (
                                            <div className="space-y-3 pt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-emerald-800 uppercase flex justify-between">
                                                        <span>Cash</span> {cashTender > 0 && <span>Nrs. {cashTender}</span>}
                                                    </label>
                                                    <Input type="number" value={cashAmountInput} onChange={(e) => setCashAmountInput(e.target.value)} className="h-10 font-bold bg-white" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-blue-800 uppercase flex justify-between">
                                                        <span>Card</span> {cardTender > 0 && <span>Nrs. {cardTender}</span>}
                                                    </label>
                                                    <Input type="number" value={cardAmountInput} onChange={(e) => setCardAmountInput(e.target.value)} className="h-10 font-bold bg-white" />
                                                </div>
                                                <div className={`mt-2 text-[10px] font-black flex justify-between rounded p-2 tracking-tighter ${isSplitValid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                    <span>Sum: {cashTender + cardTender}</span>
                                                    <span>Target: {grandTotal}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-4 md:p-6 bg-white border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 z-20">
                        <Button variant="ghost" onClick={() => setIsCheckoutModalOpen(false)}>Cancel</Button>
                        <Button
                            className={`h-11 px-8 font-black text-white shadow-md transition-all ${isWaste ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                            disabled={!isSplitValid || isCheckingOut || (isWaste && cart.length === 0)}
                            onClick={handleFinalizeCheckout}
                        >
                            {isCheckingOut ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            {isCheckingOut ? 'Processing...' : (isWaste ? 'Confirm Waste Log' : 'Complete Payment')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Variant Selection Modal */}
            <Dialog open={!!selectedParent} onOpenChange={(open) => !open && setSelectedParent(null)}>
                <DialogContent className="max-w-md w-[95vw] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
                        <DialogTitle className="text-2xl font-black">{selectedParent?.name}</DialogTitle>
                        <DialogDescription className="text-purple-100 font-medium">Select an option below</DialogDescription>
                    </DialogHeader>
                    <div className="p-6 bg-slate-50 space-y-3">
                        {selectedParent && products
                            .filter(p => p.parentId === selectedParent.id && !p.isDeleted)
                            .map(variant => {
                                const parentProduct = products.find(p => p.id === variant.parentId);
                                const availableUnits = (variant.parentId && parentProduct) ? Math.floor(parentProduct.stock / (variant.stockMultiplier || 1)) : variant.stock;
                                const isOutOfStock = variant.trackInventory !== false && availableUnits <= 0;
                                return (
                                    <Button
                                        key={variant.id}
                                        variant="outline"
                                        disabled={isOutOfStock}
                                        onClick={() => { addToCart(variant); setSelectedParent(null); }}
                                        className="w-full h-16 justify-between px-6 bg-white hover:bg-purple-50 group border-slate-200 rounded-xl"
                                    >
                                        <div className="text-left">
                                            <span className="block font-bold text-slate-800 group-hover:text-purple-700 uppercase tracking-tight">
                                                {variant.name.replace(`${selectedParent.name} - `, '').replace(`${selectedParent.name} (`, '').replace(')', '')}
                                            </span>
                                            {variant.trackInventory !== false && <span className={`text-[10px] font-bold ${availableUnits <= 5 ? 'text-amber-600' : 'text-slate-400'}`}>{availableUnits} portions left</span>}
                                        </div>
                                        <span className="block font-black text-lg text-purple-600">Nrs. {variant.price.toLocaleString()}</span>
                                    </Button>
                                );
                            })
                        }
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
