import type { UserRole } from './types/db';
import type { Permission } from './permissions';
import { hasPermission } from './permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  requiredPermission?: Permission;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'CRM',
    items: [
      { label: 'Dashboard', href: '/', icon: 'LayoutGrid', requiredPermission: 'view_dashboard' },
      { label: 'Today', href: '/routine', icon: 'Calendar', requiredPermission: 'view_dashboard' },
      { label: 'Clients', href: '/clients', icon: 'Users', requiredPermission: 'manage_customers' },
      { label: 'Tasks', href: '/tasks', icon: 'CheckSquare', requiredPermission: 'manage_tasks' },
      { label: 'RMAs', href: '/rmas', icon: 'RotateCcw', requiredPermission: 'manage_customers' },
      {
        label: 'Territories',
        href: '/territories',
        icon: 'MapPin',
        requiredPermission: 'manage_territories'
      },
      { label: 'Tags', href: '/tags', icon: 'Tag', requiredPermission: 'manage_customers' }
    ]
  },
  {
    heading: 'Commerce',
    items: [
      { label: 'Catalog', href: '/catalog', icon: 'Package', requiredPermission: 'manage_catalog' },
      {
        label: 'Orders',
        href: '/orders',
        icon: 'ShoppingCart',
        requiredPermission: 'manage_orders'
      },
      {
        label: 'Purchases',
        href: '/purchases',
        icon: 'ShoppingBag',
        requiredPermission: 'manage_orders'
      },
      {
        label: 'Featured Groups',
        href: '/featured-groups',
        icon: 'Star',
        requiredPermission: 'manage_catalog'
      },
      {
        label: 'Categories',
        href: '/categories',
        icon: 'Grid3x3',
        requiredPermission: 'manage_catalog'
      },
      {
        label: 'Image Generator',
        href: '/image-generator',
        icon: 'Wand2',
        requiredPermission: 'manage_catalog'
      }
    ]
  },
  {
    heading: 'Finances',
    items: [
      {
        label: 'Financials',
        href: '/dashboard',
        icon: 'BarChart3',
        requiredPermission: 'view_analytics'
      },
      {
        label: 'Insights',
        href: '/insights',
        icon: 'TrendingUp',
        requiredPermission: 'view_analytics'
      },
      {
        label: 'Profitability',
        href: '/reports/profitability',
        icon: 'DollarSign',
        requiredPermission: 'view_analytics'
      },
      {
        label: 'AR Aging',
        href: '/reports/ar-aging',
        icon: 'Clock',
        requiredPermission: 'view_analytics'
      },
      {
        label: 'Invoices',
        href: '/invoices',
        icon: 'FileText',
        requiredPermission: 'manage_invoices'
      }
    ]
  },
  {
    heading: 'System',
    items: [
      {
        label: 'Admin Users',
        href: '/admin-users',
        icon: 'Shield',
        requiredPermission: 'manage_users'
      }
    ]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/**
 * Filter navigation sections based on user role
 */
export function filterNavSectionsByRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!item.requiredPermission) return true;
      return hasPermission(role, item.requiredPermission);
    })
  })).filter((section) => section.items.length > 0);
}
