import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { formatDate, getRoleBadgeColor } from '@/lib/utils';
import {
  KeyRound,
  User,
  Shield,
  Bell,
  CheckCircle2,
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and system preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* License Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                License Information
              </CardTitle>
              <CardDescription>Your current license details and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">Active License</p>
                    <p className="text-sm text-green-700">Your license is valid and active</p>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white">Active</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Organization</Label>
                  <p className="font-semibold mt-1">{user.orgId || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-gray-600">License Type</Label>
                  <p className="font-semibold mt-1">Enterprise</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                User Profile
              </CardTitle>
              <CardDescription>Your personal information and role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={user.fullName} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={user.username} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={user.email} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" value={user.department || 'N/A'} readOnly />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-600">Role</Label>
                  <div className="mt-1">
                    <Badge className={getRoleBadgeColor(user.role)} variant="secondary">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                {user.approvalLimit && (
                  <div className="text-right">
                    <Label className="text-gray-600">Approval Limit</Label>
                    <p className="font-semibold mt-1 text-green-600">
                      HKD {user.approvalLimit.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your account security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-gray-500">Last changed: Unknown</p>
                </div>
                <Button variant="outline">Change Password</Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500">Add an extra layer of security</p>
                </div>
                <Button variant="outline">Enable 2FA</Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-sm text-gray-500">Manage your active sessions</p>
                </div>
                <Button variant="outline">View Sessions</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Member Since</span>
                <span className="font-medium">{formatDate(user.createdAt)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Login</span>
                <span className="font-medium">
                  {user.lastLogin ? formatDate(user.lastLogin) : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Email Notifications</span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">SMS Alerts</span>
                <Badge variant="secondary">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Push Notifications</span>
                <Badge variant="outline">Disabled</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Contact our support team for assistance with your account.
              </p>
              <Button variant="outline" className="w-full">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
