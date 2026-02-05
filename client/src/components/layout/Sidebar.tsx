import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn, getInitials, getRoleBadgeColor } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  CheckSquare,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Building2,
  Users,
  Wallet,
} from 'lucide-react';

export type ViewType = 'home' | 'vouchers' | 'create' | 'approvals' | 'companies' | 'payees' | 'users' | 'settings';

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  currentView,
  onViewChange,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { id: 'home' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vouchers' as ViewType, label: 'Vouchers', icon: FileText },
    { id: 'create' as ViewType, label: 'Create Voucher', icon: PlusCircle, roles: ['super_admin', 'admin', 'accounts'] },
    { id: 'approvals' as ViewType, label: 'Approvals', icon: CheckSquare, roles: ['super_admin', 'admin', 'manager', 'approver'] },
    { id: 'companies' as ViewType, label: 'Companies', icon: Building2, roles: ['super_admin', 'admin'] },
    { id: 'payees' as ViewType, label: 'Payees', icon: Wallet, roles: ['super_admin', 'admin', 'accounts'] },
    { id: 'users' as ViewType, label: 'Users', icon: Users, roles: ['super_admin', 'admin'] },
    { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
  ];

  const hasAccess = (roles?: string[]) => {
    if (!roles) return true;
    return user?.role && roles.includes(user.role);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-30 flex flex-col",
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-gray-900">FoodStream</h1>
              <p className="text-xs text-gray-500">Approvals Flow</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className={collapsed ? 'mx-auto' : ''}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* User Profile */}
      <div className={cn("p-4 border-b border-gray-200", collapsed && 'px-2')}>
        <div className={cn("flex items-center gap-3", collapsed && 'justify-center')}>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white font-semibold">
              {getInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.fullName}</p>
              <Badge className={cn("text-xs", getRoleBadgeColor(user.role))} variant="secondary">
                {user.role.replace('_', ' ')}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            if (!hasAccess(item.roles)) return null;

            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <li key={item.id}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    "w-full justify-start",
                    collapsed && 'px-2 justify-center',
                    isActive && 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                  )}
                  onClick={() => onViewChange(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn(collapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3')} />
                  {!collapsed && <span>{item.label}</span>}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-gray-200">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50",
            collapsed && 'justify-center'
          )}
          onClick={handleLogout}
        >
          <LogOut className={cn(collapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3')} />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
