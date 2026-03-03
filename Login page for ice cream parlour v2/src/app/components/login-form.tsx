import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { IceCream, Lock, Mail, UserCog } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import cokoLogo from 'figma:asset/f1c0929c17d946a607740ed61124eba9ade5aa37.png';

interface LoginFormProps {
  onLogin: (email: string, password: string, role: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password, role);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex justify-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <img src={cokoLogo} alt="coko Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <CardTitle className="text-3xl">coko Management System</CardTitle>
              <CardDescription className="text-base">
                The Real Taste
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm">Access Level</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="role" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <UserCog className="w-4 h-4" />
                        <span>Staff Member</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="management">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        <span>Management</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@coko.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-11"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 h-11"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg"
              >
                Sign In to Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Access: POS • Inventory • Staff Management
          </p>
        </div>
      </div>
    </div>
  );
}