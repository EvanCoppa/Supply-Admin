export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'CRM',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Today', href: '/routine' },
      { label: 'Clients', href: '/clients' },
      { label: 'Tasks', href: '/tasks' },
      { label: 'RMAs', href: '/rmas' },
      { label: 'Territories', href: '/territories' },
      { label: 'Tags', href: '/tags' }
    ]
  },
  {
    heading: 'Commerce',
    items: [
      { label: 'Catalog', href: '/catalog' },
      { label: 'Orders', href: '/orders' },
      { label: 'Purchases', href: '/purchases' },
      { label: 'Featured Groups', href: '/featured-groups' },
      { label: 'Categories', href: '/categories' },
      { label: 'Image Generator', href: '/image-generator' }
    ]
  },
  {
    heading: 'Finances',
    items: [
      { label: 'Financials', href: '/dashboard' },
      { label: 'Insights', href: '/insights' },
      { label: 'Profitability', href: '/reports/profitability' },
      { label: 'AR Aging', href: '/reports/ar-aging' },
      { label: 'Invoices', href: '/invoices' }
    ]
  },
  {
    heading: 'System',
    items: [{ label: 'Admin Users', href: '/admin-users' }]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
