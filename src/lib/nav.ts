export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'CRM',
    items: [
      { label: 'Dashboard', href: '/', icon: 'LayoutGrid' },
      { label: 'Today', href: '/routine', icon: 'Calendar' },
      { label: 'Clients', href: '/clients', icon: 'Users' },
      { label: 'Tasks', href: '/tasks', icon: 'CheckSquare' },
      { label: 'RMAs', href: '/rmas', icon: 'RotateCcw' },
      { label: 'Territories', href: '/territories', icon: 'MapPin' },
      { label: 'Tags', href: '/tags', icon: 'Tag' }
    ]
  },
  {
    heading: 'Commerce',
    items: [
      { label: 'Catalog', href: '/catalog', icon: 'Package' },
      { label: 'Orders', href: '/orders', icon: 'ShoppingCart' },
      { label: 'Purchases', href: '/purchases', icon: 'ShoppingBag' },
      { label: 'Featured Groups', href: '/featured-groups', icon: 'Star' },
      { label: 'Categories', href: '/categories', icon: 'Grid3x3' },
      { label: 'Image Generator', href: '/image-generator', icon: 'Wand2' }
    ]
  },
  {
    heading: 'Finances',
    items: [
      { label: 'Financials', href: '/dashboard', icon: 'BarChart3' },
      { label: 'Insights', href: '/insights', icon: 'TrendingUp' },
      { label: 'Profitability', href: '/reports/profitability', icon: 'DollarSign' },
      { label: 'AR Aging', href: '/reports/ar-aging', icon: 'Clock' },
      { label: 'Invoices', href: '/invoices', icon: 'FileText' }
    ]
  },
  {
    heading: 'System',
    items: [{ label: 'Admin Users', href: '/admin-users', icon: 'Shield' }]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
