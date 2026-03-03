import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Plus, Mail, Phone, Calendar, CheckCircle, XCircle } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'staff' | 'management';
  status: 'active' | 'inactive';
  hireDate: string;
  hoursThisWeek: number;
}

const INITIAL_STAFF: StaffMember[] = [
  { id: '1', name: 'Emma Johnson', email: 'emma@coko.com', phone: '555-0101', role: 'management', status: 'active', hireDate: '2024-01-15', hoursThisWeek: 38 },
  { id: '2', name: 'Michael Chen', email: 'michael@coko.com', phone: '555-0102', role: 'staff', status: 'active', hireDate: '2024-03-20', hoursThisWeek: 32 },
  { id: '3', name: 'Sarah Williams', email: 'sarah@coko.com', phone: '555-0103', role: 'staff', status: 'active', hireDate: '2024-06-10', hoursThisWeek: 28 },
  { id: '4', name: 'James Rodriguez', email: 'james@coko.com', phone: '555-0104', role: 'staff', status: 'active', hireDate: '2025-01-05', hoursThisWeek: 35 },
  { id: '5', name: 'Lisa Anderson', email: 'lisa@coko.com', phone: '555-0105', role: 'staff', status: 'inactive', hireDate: '2023-11-12', hoursThisWeek: 0 },
];

export function StaffSection() {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff' as 'staff' | 'management',
    hireDate: new Date().toISOString().split('T')[0],
  });

  const handleAddStaff = () => {
    if (!formData.name || !formData.email) return;

    const newStaff: StaffMember = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      status: 'active',
      hireDate: formData.hireDate,
      hoursThisWeek: 0,
    };

    setStaff([...staff, newStaff]);
    setFormData({ name: '', email: '', phone: '', role: 'staff', hireDate: new Date().toISOString().split('T')[0] });
    setIsAddDialogOpen(false);
  };

  const toggleStaffStatus = (id: string) => {
    setStaff(staff.map(member =>
      member.id === id
        ? { ...member, status: member.status === 'active' ? 'inactive' : 'active' }
        : member
    ));
  };

  const filteredStaff = staff.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeStaff = staff.filter(m => m.status === 'active').length;
  const totalHours = staff.reduce((sum, m) => sum + m.hoursThisWeek, 0);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Staff</CardDescription>
            <CardTitle className="text-3xl">{staff.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Staff</CardDescription>
            <CardTitle className="text-3xl text-green-600">{activeStaff}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Hours (This Week)</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{totalHours}h</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Staff Management</CardTitle>
              <CardDescription>Manage team members and schedules</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Staff
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Staff Member</DialogTitle>
                  <DialogDescription>Add a new team member to coko</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="staff-name">Full Name</Label>
                    <Input
                      id="staff-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-email">Email Address</Label>
                    <Input
                      id="staff-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@coko.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-phone">Phone Number</Label>
                    <Input
                      id="staff-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="555-0100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-role">Role</Label>
                    <Select value={formData.role} onValueChange={(value: 'staff' | 'management') => setFormData({ ...formData, role: value })}>
                      <SelectTrigger id="staff-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff Member</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hire-date">Hire Date</Label>
                    <Input
                      id="hire-date"
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleAddStaff} className="w-full">
                    Add Staff Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Hours This Week</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map(member => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-500 text-white">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" />
                            Joined {member.hireDate}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <p className="flex items-center gap-2 text-gray-600">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </p>
                        {member.phone && (
                          <p className="flex items-center gap-2 text-gray-600">
                            <Phone className="w-3 h-3" />
                            {member.phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'management' ? 'default' : 'outline'}>
                        {member.role === 'management' ? 'Management' : 'Staff'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {member.hoursThisWeek}h
                    </TableCell>
                    <TableCell>
                      {member.status === 'active' ? (
                        <Badge className="bg-green-500 gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStaffStatus(member.id)}
                      >
                        {member.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
