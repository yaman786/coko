import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { POSSection } from './pos-section';
import { InventorySection } from './inventory-section';
import { StaffSection } from './staff-section';
import { Button } from './ui/button';
import { IceCream, LogOut, ShoppingCart, Package, Users } from 'lucide-react';
import cokoLogo from 'figma:asset/f1c0929c17d946a607740ed61124eba9ade5aa37.png';

interface DashboardProps {
  userRole: string;
  onLogout: () => void;
}

export function Dashboard({ userRole, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('pos');

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center">
                <img src={cokoLogo} alt="coko Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl">coko</h1>
                <p className="text-xs text-gray-500">The Real Taste</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {userRole === 'management' ? 'Management' : 'Staff Member'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="pos" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              POS
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger 
              value="staff" 
              className="gap-2"
              disabled={userRole !== 'management'}
            >
              <Users className="w-4 h-4" />
              Staff
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pos" className="mt-0">
            <POSSection />
          </TabsContent>

          <TabsContent value="inventory" className="mt-0">
            <InventorySection userRole={userRole} />
          </TabsContent>

          <TabsContent value="staff" className="mt-0">
            <StaffSection />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}