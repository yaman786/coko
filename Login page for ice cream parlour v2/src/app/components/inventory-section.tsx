import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Edit, AlertTriangle } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  lastRestocked: string;
}

const INITIAL_INVENTORY: InventoryItem[] = [
  // Classic Flavors
  { id: '1', name: 'Vanilla', category: 'Classic Flavors', quantity: 45, unit: 'L', lowStockThreshold: 20, lastRestocked: '2026-02-20' },
  { id: '2', name: 'Strawberry', category: 'Classic Flavors', quantity: 38, unit: 'L', lowStockThreshold: 20, lastRestocked: '2026-02-20' },
  { id: '3', name: 'Butterscotch', category: 'Classic Flavors', quantity: 32, unit: 'L', lowStockThreshold: 20, lastRestocked: '2026-02-22' },
  
  // Exotic Flavors
  { id: '4', name: 'Cookies & Cream', category: 'Exotic Flavors', quantity: 28, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-23' },
  { id: '5', name: 'Choco Chips', category: 'Exotic Flavors', quantity: 30, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-21' },
  { id: '6', name: '21st Love', category: 'Exotic Flavors', quantity: 22, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-19' },
  { id: '7', name: 'Mango', category: 'Exotic Flavors', quantity: 35, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-24' },
  { id: '8', name: 'Orange', category: 'Exotic Flavors', quantity: 18, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-18' },
  { id: '9', name: 'Blueberry', category: 'Exotic Flavors', quantity: 12, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-15' },
  { id: '10', name: 'Kiwi', category: 'Exotic Flavors', quantity: 25, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-22' },
  { id: '11', name: 'Chocolate', category: 'Exotic Flavors', quantity: 42, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-24' },
  { id: '12', name: 'Pistachio', category: 'Exotic Flavors', quantity: 28, unit: 'L', lowStockThreshold: 15, lastRestocked: '2026-02-20' },
  
  // Signature Flavors
  { id: '13', name: 'Honey Dates & Ginger', category: 'Signature Flavors', quantity: 15, unit: 'L', lowStockThreshold: 10, lastRestocked: '2026-02-21' },
  { id: '14', name: 'Coffee With walnuts', category: 'Signature Flavors', quantity: 18, unit: 'L', lowStockThreshold: 10, lastRestocked: '2026-02-23' },
  { id: '15', name: 'Dates & cream', category: 'Signature Flavors', quantity: 14, unit: 'L', lowStockThreshold: 10, lastRestocked: '2026-02-20' },
  { id: '16', name: 'Oreo caramel', category: 'Signature Flavors', quantity: 20, unit: 'L', lowStockThreshold: 10, lastRestocked: '2026-02-24' },
  
  // Fantasy Flavors
  { id: '17', name: 'Banana with Cinnamon', category: 'Fantasy Flavors', quantity: 12, unit: 'L', lowStockThreshold: 8, lastRestocked: '2026-02-22' },
  { id: '18', name: 'Rums & Raisins', category: 'Fantasy Flavors', quantity: 10, unit: 'L', lowStockThreshold: 8, lastRestocked: '2026-02-21' },
  { id: '19', name: 'Royal Raibhog', category: 'Fantasy Flavors', quantity: 8, unit: 'L', lowStockThreshold: 8, lastRestocked: '2026-02-19' },
  
  // Supplies & Toppings
  { id: '20', name: 'Waffle Cones', category: 'Supplies', quantity: 150, unit: 'pcs', lowStockThreshold: 50, lastRestocked: '2026-02-23' },
  { id: '21', name: 'Sugar Cones', category: 'Supplies', quantity: 120, unit: 'pcs', lowStockThreshold: 50, lastRestocked: '2026-02-24' },
  { id: '22', name: 'Chocolate Syrup', category: 'Toppings', quantity: 8, unit: 'bottles', lowStockThreshold: 5, lastRestocked: '2026-02-21' },
  { id: '23', name: 'Sprinkles', category: 'Toppings', quantity: 12, unit: 'containers', lowStockThreshold: 6, lastRestocked: '2026-02-19' },
  { id: '24', name: 'Napkins', category: 'Supplies', quantity: 500, unit: 'pcs', lowStockThreshold: 200, lastRestocked: '2026-02-24' },
];

interface InventorySectionProps {
  userRole: string;
}

export function InventorySection({ userRole }: InventorySectionProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '',
    lowStockThreshold: '',
  });

  const handleAddItem = () => {
    if (!formData.name || !formData.quantity) return;

    const newItem: InventoryItem = {
      id: Date.now().toString(),
      name: formData.name,
      category: formData.category || 'Other',
      quantity: parseInt(formData.quantity),
      unit: formData.unit || 'units',
      lowStockThreshold: parseInt(formData.lowStockThreshold) || 10,
      lastRestocked: new Date().toISOString().split('T')[0],
    };

    setInventory([...inventory, newItem]);
    setFormData({ name: '', category: '', quantity: '', unit: '', lowStockThreshold: '' });
    setIsAddDialogOpen(false);
  };

  const handleUpdateStock = (id: string, newQuantity: number) => {
    setInventory(inventory.map(item =>
      item.id === id
        ? { ...item, quantity: newQuantity, lastRestocked: new Date().toISOString().split('T')[0] }
        : item
    ));
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = inventory.filter(item => item.quantity <= item.lowStockThreshold);

  return (
    <div className="space-y-6">
      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alert
            </CardTitle>
            <CardDescription>
              {lowStockItems.length} {lowStockItems.length === 1 ? 'item needs' : 'items need'} restocking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(item => (
                <Badge key={item.id} variant="outline" className="border-orange-300 text-orange-700">
                  {item.name}: {item.quantity} {item.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inventory Management</CardTitle>
              <CardDescription>Track and manage stock levels</CardDescription>
            </div>
            {userRole === 'management' && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Inventory Item</DialogTitle>
                    <DialogDescription>Add a new item to the inventory</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Item Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Vanilla Ice Cream"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g., Ice Cream, Supplies"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Input
                          id="unit"
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          placeholder="L, pcs, kg"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="threshold">Low Stock Threshold</Label>
                      <Input
                        id="threshold"
                        type="number"
                        value={formData.lowStockThreshold}
                        onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                        placeholder="10"
                      />
                    </div>
                    <Button onClick={handleAddItem} className="w-full">
                      Add to Inventory
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Restocked</TableHead>
                  {userRole === 'management' && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map(item => {
                  const isLowStock = item.quantity <= item.lowStockThreshold;
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell>
                        {isLowStock ? (
                          <Badge variant="destructive">Low Stock</Badge>
                        ) : (
                          <Badge className="bg-green-500">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {item.lastRestocked}
                      </TableCell>
                      {userRole === 'management' && (
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Edit className="w-3 h-3" />
                                Update
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Stock: {item.name}</DialogTitle>
                                <DialogDescription>Adjust stock quantity</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Current Quantity: {item.quantity} {item.unit}</Label>
                                  <Input
                                    type="number"
                                    defaultValue={item.quantity}
                                    onChange={(e) => {
                                      const newQty = parseInt(e.target.value);
                                      if (!isNaN(newQty)) {
                                        handleUpdateStock(item.id, newQty);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}