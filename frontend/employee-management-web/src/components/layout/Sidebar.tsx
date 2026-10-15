import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Palette,
  Briefcase,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/api';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'My Attendance', to: '/attendance', icon: Clock },
  { label: 'Leave Requests', to: '/leave', icon: Calendar },
  { label: 'Employees', to: '/employees', icon: Users, roles: ['Manager', 'Admin'] },
  { label: 'Departments', to: '/departments', icon: Building2, roles: ['Admin'] },
  { label: 'Leave Types', to: '/leave-types', icon: Settings, roles: ['Admin'] },
  { label: 'Design System', to: '/design', icon: Palette },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  className,
}) => {
  const { user } = useAuth();

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <aside
      className={cn(
        'sidebar h-screen flex flex-col justify-between transition-all duration-300 z-30 select-none',
        collapsed ? 'w-20' : 'w-64',
        className
      )}
    >
      <div>
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-400 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20 flex-shrink-0">
              <Briefcase className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-white text-base tracking-tight leading-tight">
                  TeamTime
                </span>
                <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
                  HR System
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex h-7 w-7 rounded-lg items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1.5 mt-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'sidebar-link group relative',
                    isActive && 'active',
                    collapsed && 'justify-center px-0'
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2 py-1 rounded bg-neutral-900 text-white text-xs whitespace-nowrap shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item.label}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-neutral-800 text-xs text-neutral-500">
        {!collapsed ? (
          <div className="flex justify-between items-center px-2">
            <span>TeamTime v1.0</span>
            <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">
              PROD
            </span>
          </div>
        ) : (
          <div className="text-center font-mono text-[10px]">v1.0</div>
        )}
      </div>
    </aside>
  );
};
