/**
 * Premium Dentist Dashboard Layout v2
 * Modern, responsive layout with sidebar, topbar, and content area
 */

import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import DentistSidebar from './DentistSidebar';
import DentistTopBar from './DentistTopBar';

// Page title mapping
const PAGE_TITLES: Record<string, { title: string; description?: string }> = {
  'my-dashboard': { title: 'Dashboard', description: 'Your practice at a glance' },
  'my-practice': { title: 'My Practice', description: 'Clinic details and performance' },
  'my-appointments': { title: 'Appointments', description: 'Manage your schedule' },
  'my-availability': { title: 'Availability', description: 'Set your working hours' },
  'my-appointment-types': { title: 'Appointment Types', description: 'Configure service types' },
  'my-patients': { title: 'Patients', description: 'Patient records and history' },
  'my-messages': { title: 'Messages', description: 'Patient communications' },
  'my-intake-forms': { title: 'Intake Forms', description: 'Patient intake management' },
  'my-operations': { title: 'Automation', description: 'Automated workflows' },
  'my-profile': { title: 'Edit Profile', description: 'Update your practice profile' },
  'my-team': { title: 'Team', description: 'Manage team members' },
  'my-services': { title: 'Treatments', description: 'Services you offer' },
  'my-insurance': { title: 'Insurance', description: 'Accepted insurance providers' },
  'my-reputation': { title: 'Reputation Suite', description: 'Reviews and reputation management' },
  'my-templates': { title: 'Templates', description: 'Message templates' },
  'my-settings': { title: 'Settings', description: 'Account preferences' },
  'my-support': { title: 'Support', description: 'Get help and support' },
};

interface DentistDashboardLayoutV2Props {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function DentistDashboardLayoutV2({
  children,
  activeTab,
  onTabChange,
}: DentistDashboardLayoutV2Props) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const pageInfo = PAGE_TITLES[activeTab] || { title: 'Dashboard' };

  // Build breadcrumbs based on tab
  const getBreadcrumbs = () => {
    const crumbs: { label: string; onClick?: () => void }[] = [
      { label: 'Dashboard', onClick: () => onTabChange('my-dashboard') },
    ];

    // Add section crumb
    if (activeTab.startsWith('my-') && activeTab !== 'my-dashboard') {
      const section = getSection(activeTab);
      if (section) {
        crumbs.push({ label: section });
      }
    }

    return crumbs;
  };

  const getSection = (tabId: string): string | null => {
    const operationsTabs = ['my-appointments', 'my-availability', 'my-appointment-types', 'my-patients', 'my-messages', 'my-intake-forms', 'my-operations'];
    const profileTabs = ['my-profile', 'my-team', 'my-services', 'my-insurance'];
    const settingsTabs = ['my-settings', 'my-support'];

    if (operationsTabs.includes(tabId)) return 'Operations';
    if (profileTabs.includes(tabId)) return 'Profile';
    if (tabId === 'my-reputation') return 'Reputation';
    if (tabId === 'my-templates') return 'Communication';
    if (settingsTabs.includes(tabId)) return 'Settings';
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <DentistSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main content area */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300 ease-out',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
        )}
      >
        {/* Top Bar */}
        <DentistTopBar
          pageTitle={pageInfo.title}
          pageDescription={pageInfo.description}
          breadcrumbs={getBreadcrumbs()}
        />

        {/* Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
