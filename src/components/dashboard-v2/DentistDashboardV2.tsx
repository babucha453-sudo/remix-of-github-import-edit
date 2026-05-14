/**
 * Dentist Dashboard V2 Tab
 * Wrapper component that uses the new V3 design
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DentistDashboardLayoutV2 from './DentistDashboardLayoutV2';
import DentistSidebarV3 from './DentistSidebarV3';
import DentistTopBarV3 from './DentistTopBarV3';
import DashboardOverviewV3 from './DashboardOverviewV3';
import MyPracticePage from './MyPracticePage';
import AppointmentsPageV2 from './AppointmentsPageV2';

// Import existing tabs that we're keeping
import AvailabilityManagementTab from '@/components/dentist/AvailabilityManagementTab';
import AppointmentTypesTab from '@/components/dentist/AppointmentTypesTab';
import PatientsTab from '@/components/dentist/PatientsTab';
import MessagesTab from '@/components/dentist/MessagesTab';
import IntakeFormsTab from '@/components/dentist/IntakeFormsTab';
import OperationsTab from '@/components/dentist/OperationsTab';
import ProfileEditorTab from '@/components/dentist/ProfileEditorTab';
import TeamManagementTab from '@/components/dentist/TeamManagementTab';
import ServicesTab from '@/components/dentist/ServicesTab';
import InsuranceManagementTab from '@/components/dentist/InsuranceManagementTab';
import DentistReputationHub from '@/components/reputation/DentistReputationHub';
import TemplatesTab from '@/components/dentist/TemplatesTab';
import DentistSettingsTab from '@/components/dentist/DentistSettingsTab';
import SupportTicketsTab from '@/components/dentist/SupportTicketsTab';
import NotificationPreferencesTab from '@/components/dentist/NotificationPreferencesTab';
import FormWorkflowTab from '@/components/dentist/FormWorkflowTab';
import GalleryManagementTab from '@/components/dentist/GalleryManagementTab';
import PlatformReviewsTab from '@/components/dentist/PlatformReviewsTab';
import AnalyticsTab from './AnalyticsTab';
import MarketingTab from './MarketingTab';
import SEOTab from './SEOTab';

// Page title mapping
const PAGE_TITLES: Record<string, { title: string; description?: string }> = {
  'my-dashboard': { title: 'Dashboard', description: 'Your practice at a glance' },
  'my-practice': { title: 'My Practice', description: 'Clinic details and performance' },
  'my-appointments': { title: 'Appointments', description: 'Manage your schedule' },
  'my-availability': { title: 'Availability', description: 'Set your working hours' },
  'my-appointment-types': { title: 'Services', description: 'Configure service types' },
  'my-patients': { title: 'Patients', description: 'Patient records and history' },
  'my-messages': { title: 'Messages', description: 'Patient communications' },
  'my-intake-forms': { title: 'Intake Forms', description: 'Patient intake management' },
  'my-operations': { title: 'Automation', description: 'Automated workflows' },
  'my-profile': { title: 'Edit Profile', description: 'Update your practice profile' },
  'my-team': { title: 'Team', description: 'Manage team members' },
  'my-services': { title: 'Treatments', description: 'Services you offer' },
  'my-insurance': { title: 'Insurance', description: 'Accepted insurance providers' },
  'my-reputation': { title: 'Reputation', description: 'Reviews and reputation management' },
  'my-gallery': { title: 'Before & After', description: 'Showcase your work' },
  'my-platform-reviews': { title: 'Reviews', description: 'Patient reviews' },
  'my-analytics': { title: 'Analytics', description: 'Practice performance' },
  'my-marketing': { title: 'Marketing', description: 'Marketing tools' },
  'my-seo': { title: 'SEO', description: 'Search optimization' },
  'my-templates': { title: 'Templates', description: 'Message templates' },
  'my-settings': { title: 'Settings', description: 'Account preferences' },
  'my-support': { title: 'Support', description: 'Get help and support' },
};

export default function DentistDashboardV2() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'my-dashboard';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const pageInfo = PAGE_TITLES[activeTab] || { title: 'Dashboard' };

  const renderContent = () => {
    switch (activeTab) {
      case 'my-dashboard':
        return <DashboardOverviewV3 onNavigate={handleTabChange} />;
      case 'my-practice':
        return <MyPracticePage onNavigate={handleTabChange} />;
      case 'my-appointments':
        return <AppointmentsPageV2 onNavigate={handleTabChange} />;
      case 'my-availability':
        return <AvailabilityManagementTab />;
      case 'my-appointment-types':
        return <AppointmentTypesTab />;
      case 'my-patients':
        return <PatientsTab />;
      case 'my-messages':
        return <MessagesTab />;
      case 'my-intake-forms':
        return <IntakeFormsTab />;
      case 'my-form-workflows':
        return <FormWorkflowTab />;
      case 'my-operations':
        return <OperationsTab />;
      case 'my-profile':
        return <ProfileEditorTab />;
      case 'my-team':
        return <TeamManagementTab />;
      case 'my-services':
        return <ServicesTab />;
      case 'my-insurance':
        return <InsuranceManagementTab />;
      case 'my-reputation':
        return <DentistReputationHub />;
      case 'my-gallery':
        return <GalleryManagementTab />;
      case 'my-platform-reviews':
        return <PlatformReviewsTab />;
      case 'my-analytics':
        return <AnalyticsTab onNavigate={handleTabChange} />;
      case 'my-marketing':
        return <MarketingTab onNavigate={handleTabChange} />;
      case 'my-seo':
        return <SEOTab onNavigate={handleTabChange} />;
      case 'my-templates':
        return <TemplatesTab />;
      case 'my-notifications':
        return <NotificationPreferencesTab />;
      case 'my-settings':
        return <DentistSettingsTab />;
      case 'my-support':
        return <SupportTicketsTab />;
      default:
        return <DashboardOverviewV3 onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* New Sidebar V3 */}
      <DentistSidebarV3
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'ml-[72px]' : 'ml-64'
        }`}
      >
        {/* Top Bar V3 */}
        <DentistTopBarV3
          pageTitle={pageInfo.title}
          pageDescription={pageInfo.description}
        />

        {/* Content */}
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
