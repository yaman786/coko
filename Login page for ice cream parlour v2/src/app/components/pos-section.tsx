import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const MENU_ITEMS = [
  // Classic Flavors - Nrs. 100
  { id: '1', name: 'Vanilla', price: 100, category: 'Classic Flavors' },
  { id: '2', name: 'Strawberry', price: 100, category: 'Classic Flavors' },
  { id: '3', name: 'Butterscotch', price: 100, category: 'Classic Flavors' },
  
  // Exotic Flavors - Nrs. 140
  { id: '4', name: 'Cookies & Cream', price: 140, category: 'Exotic Flavors' },
  { id: '5', name: 'Choco Chips', price: 140, category: 'Exotic Flavors' },
  { id: '6', name: '21st Love', price: 140, category: 'Exotic Flavors' },
  { id: '7', name: 'Mango', price: 140, category: 'Exotic Flavors' },
  { id: '8', name: 'Orange', price: 140, category: 'Exotic Flavors' },
  { id: '9', name: 'Blueberry', price: 140, category: 'Exotic Flavors' },
  { id: '10', name: 'Kiwi', price: 140, category: 'Exotic Flavors' },
  { id: '11', name: 'Chocolate', price: 140, category: 'Exotic Flavors' },
  { id: '12', name: 'Pistachio', price: 140, category: 'Exotic Flavors' },
  
  // Signature Flavors - Nrs. 180
  { id: '13', name: 'Honey Dates & Ginger', price: 180, category: 'Signature Flavors' },
  { id: '14', name: 'Coffee With walnuts', price: 180, category: 'Signature Flavors' },
  { id: '15', name: 'Dates & cream', price: 180, category: 'Signature Flavors' },
  { id: '16', name: 'Oreo caramel', price: 180, category: 'Signature Flavors' },
  
  // Fantasy Flavors - Nrs. 200
  { id: '17', name: 'Banana with Cinnamon', price: 200, category: 'Fantasy Flavors' },
  { id: '18', name: 'Rums & Raisins', price: 200, category: 'Fantasy Flavors' },
  { id: '19', name: 'Royal Raibhog', price: 200, category: 'Fantasy Flavors' },
];

export function POSSection() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const addToCart = (item: typeof MENU_ITEMS[0]) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item =>
      item.id === id
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item
    ).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.13; // 13% VAT (Nepal)
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    alert(`Order total: Nrs. ${total.toFixed(2)}\nPayment processed successfully!`);
    setCart([]);
  };

  const filteredItems = MENU_ITEMS.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = Array.from(new Set(MENU_ITEMS.map(item => item.category)));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Menu Items */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Menu Items</CardTitle>
            <CardDescription>Select items to add to cart</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-4"
            />

            {categories.map(category => {
              const categoryItems = filteredItems.filter(item => item.category === category);
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="mb-6">
                  <h3 className="text-sm mb-3 text-gray-600">{category}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {categoryItems.map(item => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="h-auto flex-col items-start p-4 hover:bg-purple-50 hover:border-purple-300"
                        onClick={() => addToCart(item)}
                      >
                        <span className="text-sm">{item.name}</span>
                        <span className="text-purple-600 mt-1">Nrs. {item.price}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Cart */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Current Order
            </CardTitle>
            <CardDescription>
              {cart.length} {cart.length === 1 ? 'item' : 'items'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Cart is empty</p>
            ) : (
              <>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">Nrs. {item.price} each</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 ml-1"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Nrs. {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (13%):</span>
                    <span>Nrs. {tax.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg">
                    <span>Total:</span>
                    <span className="text-purple-600">Nrs. {total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                  onClick={handleCheckout}
                >
                  Complete Order
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}