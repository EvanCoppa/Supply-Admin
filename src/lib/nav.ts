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
    heading: 'Commerce',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Catalog', href: '/catalog' },
      { label: 'Inventory', href: '/inventory' },
      { label: 'Orders', href: '/orders' },
      { label: 'Featured Groups', href: '/featured-groups' },
      { label: 'Categories', href: '/categories' },
      { label: 'Image Generator', href: '/image-generator' }
    ]
  },
  {
    heading: 'CRM',
    items: [
      { label: 'Clients', href: '/clients' },
      { label: 'Tasks', href: '/tasks' },
      { label: 'Invoices', href: '/invoices' },
      { label: 'RMAs', href: '/rmas' },
      { label: 'Territories', href: '/territories' },
      { label: 'Tags', href: '/tags' }
    ]
  },
  {
    heading: 'System',
    items: [{ label: 'Admin Users', href: '/admin-users' }]
  }
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
