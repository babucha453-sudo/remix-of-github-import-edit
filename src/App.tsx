import { useEffect, Suspense } from "react";
import { lazyRetry } from "@/utils/lazyRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import { HelmetProvider } from "react-helmet-async";
const PandaBot = lazyRetry(() => import("@/components/PandaBot").then(mod => ({ default: mod.PandaBot })));
import { PerformanceMonitor } from "@/hooks/useWebVitals";
import { TrailingSlashRedirect } from "@/components/TrailingSlashRedirect";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";

// Critical pages - load immediately for fast FCP
import Index from "./pages/Index";
import AISearchPage from "./pages/AISearchPage";
import NotFound from "./pages/NotFound";
import DentistSignupPage from "./pages/DentistSignupPage";

// Lazy-loaded pages - code split for smaller initial bundle
const Auth = lazyRetry(() => import("./pages/Auth"));
const AuthCallback = lazyRetry(() => import("./pages/AuthCallback"));
const AdminDashboard = lazyRetry(() => import("./pages/admin/AdminDashboard"));
const DentistDashboardV2 = lazyRetry(() => import("./components/dashboard-v2/DentistDashboardV2"));

// Public Pages - lazy loaded
const AboutPage = lazyRetry(() => import("./pages/AboutPage"));
const ContactPage = lazyRetry(() => import("./pages/ContactPage"));
const FAQPage = lazyRetry(() => import("./pages/FAQPage"));
const HowItWorksPage = lazyRetry(() => import("./pages/HowItWorksPage"));
const PrivacyPage = lazyRetry(() => import("./pages/PrivacyPage"));
const TermsPage = lazyRetry(() => import("./pages/TermsPage"));
const SitemapPage = lazyRetry(() => import("./pages/SitemapPage"));

// Directory Pages - lazy loaded for performance
const StatePage = lazyRetry(() => import("./pages/StatePage"));
const CityPage = lazyRetry(() => import("./pages/CityPage"));
const ServicePage = lazyRetry(() => import("./pages/ServicePage"));
const ServicesPage = lazyRetry(() => import("./pages/ServicesPage"));
const ServiceLocationPage = lazyRetry(() => import("./pages/ServiceLocationPage"));
const ClinicPage = lazyRetry(() => import("./pages/ClinicPage"));
const DentistPage = lazyRetry(() => import("./pages/DentistPage"));
const InsuranceLocationPage = lazyRetry(() => import("./pages/InsuranceLocationPage"));

// Blog Pages - lazy loaded
const BlogPage = lazyRetry(() => import("./pages/BlogPage"));
const BlogPostPage = lazyRetry(() => import("./pages/BlogPostPage"));

// Business Pages - lazy loaded
const ClaimProfilePage = lazyRetry(() => import("./pages/ClaimProfilePage"));
const ListYourPracticePage = lazyRetry(() => import("./pages/ListYourPracticePage"));
const ListYourPracticeSuccessPage = lazyRetry(() => import("./pages/ListYourPracticeSuccessPage"));
const PricingPage = lazyRetry(() => import("./pages/PricingPage"));
const InsurancePage = lazyRetry(() => import("./pages/InsurancePage"));
const InsuranceDetailPage = lazyRetry(() => import("./pages/InsuranceDetailPage"));
const ReviewFunnelPage = lazyRetry(() => import("./pages/ReviewFunnelPage"));
const ReviewRequestPage = lazyRetry(() => import("./pages/ReviewRequestPage"));
const GMBOnboarding = lazyRetry(() => import("./pages/GMBOnboarding"));
const GMBBusinessSelection = lazyRetry(() => import("./pages/GMBBusinessSelection"));
const AppointmentManagePage = lazyRetry(() => import("./pages/AppointmentManagePage"));
const PatientFormPage = lazyRetry(() => import("./pages/PatientFormPage"));
const BookDirectPage = lazyRetry(() => import("./pages/BookDirectPage"));
const HomeV2 = lazyRetry(() => import("./pages/HomeV2"));

// Free Tools - Phase 3
const DentalCostCalculator = lazyRetry(() => import("./pages/tools/DentalCostCalculator"));
const InsuranceChecker = lazyRetry(() => import("./pages/tools/InsuranceChecker"));
const EmergencyDentist = lazyRetry(() => import("./pages/EmergencyDentist"));

const queryClient = new QueryClient();

// Scroll to top component
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// Visitor tracking component - tracks sessions, pageviews, events
function VisitorTracker() {
  useVisitorTracking();
  return null;
}

// Dynamic favicon component - updates favicon from branding settings
function DynamicFavicon() {
  useDynamicFavicon();
  return null;
}

// Loading fallback for lazy-loaded routes - optimized for CLS
const PageLoader = () => (
  <div className="page-loader" role="status" aria-label="Loading page">
    <div className="page-loader-text">Loading...</div>
  </div>
);

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          {/* Performance monitoring in development */}
          {process.env.NODE_ENV === 'development' && <PerformanceMonitor debug />}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Google Analytics 4 tracking - must be inside Router for useLocation */}
            <AnalyticsProvider>
              <ScrollToTop />
              <TrailingSlashRedirect />
              <VisitorTracker />
              <DynamicFavicon />
              <PandaBot />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Homepage - New V2 Design (Default) */}
                  <Route path="/" element={<HomeV2 />} />

                  {/* Old Homepage - Preserved for reference */}
                  <Route path="/home-old" element={<Index />} />

                  {/* AI Search */}
                  <Route path="/search" element={<AISearchPage />} />
                  <Route path="/find-dentist" element={<AISearchPage />} />

                  {/* Directory - Services */}
                  <Route path="/services" element={<ServicesPage />} />
                  <Route path="/services/:serviceSlug" element={<ServicePage />} />

                  {/* Directory - Profiles - Exact slug match only, extra paths = 404 */}
                  <Route path="/clinic/:clinicSlug" element={<ClinicPage />} />
                  <Route path="/clinic/:clinicSlug/*" element={<NotFound />} />
                  <Route path="/dentist/:dentistSlug" element={<DentistPage />} />
                  <Route path="/dentist/:dentistSlug/*" element={<NotFound />} />

                  {/* Directory - State Pages (e.g., /ca, /ma) */}
                  <Route path="/:stateSlug" element={<StatePage />} />

                  {/* Insurance + City pages - MUST be BEFORE city to take precedence */}
                  <Route path="/:stateSlug/:citySlug/:insuranceSlug-dentists" element={<InsuranceLocationPage />} />

                  {/* Directory - City Pages (e.g., /ca/los-angeles) */}
                  <Route path="/:stateSlug/:citySlug" element={<CityPage />} />

                  {/* Directory - Service + City combination (e.g., /ca/los-angeles/cosmetic-dentist) */}
                  <Route path="/:stateSlug/:citySlug/:serviceSlug" element={<ServiceLocationPage />} />

                  {/* Blog */}
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/:postSlug" element={<BlogPostPage />} />

                  {/* Auth */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/signup/dentist" element={<DentistSignupPage />} />
                  <Route path="/onboarding" element={<GMBOnboarding />} />
                  <Route path="/gmb-select" element={<GMBBusinessSelection />} />

                  {/* Dashboards */}
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/dashboard" element={<DentistDashboardV2 />} />
                  <Route path="/dashboard-v2" element={<DentistDashboardV2 />} />

                  {/* Static Pages */}
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/how-it-works" element={<HowItWorksPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/sitemap" element={<SitemapPage />} />

                  {/* Pricing */}
                  <Route path="/pricing" element={<PricingPage />} />

                  {/* Insurance */}
                  <Route path="/insurance" element={<InsurancePage />} />
                  <Route path="/insurance/:insuranceSlug" element={<InsuranceDetailPage />} />

                  {/* Business */}
                  <Route path="/claim-profile" element={<ClaimProfilePage />} />
                  <Route path="/list-your-practice" element={<ListYourPracticePage />} />
                  <Route path="/list-your-practice/success" element={<ListYourPracticeSuccessPage />} />
                  <Route path="/review/:clinicId" element={<ReviewFunnelPage />} />
                  <Route path="/rq/:requestCode" element={<ReviewRequestPage />} />
                  <Route path="/appointment/:token" element={<AppointmentManagePage />} />
                  <Route path="/form/:submissionId" element={<PatientFormPage />} />
                  <Route path="/book/:clinicId" element={<BookDirectPage />} />

                  {/* Free Tools - Phase 3 */}
                  <Route path="/tools/dental-cost-calculator" element={<DentalCostCalculator />} />
                  <Route path="/tools/insurance-checker" element={<InsuranceChecker />} />
                  <Route path="/emergency-dentist" element={<EmergencyDentist />} />

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AnalyticsProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
