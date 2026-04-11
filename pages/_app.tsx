import type { AppProps } from "next/app";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ThemeProvider, useTheme } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import "@/index.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import dynamic from "next/dynamic";

const PandaBot = dynamic(() => import("@/components/PandaBot").then(mod => mod.PandaBot), {
  ssr: false,
  loading: () => null,
});

const AnalyticsDashboardLazy = dynamic(() => import("@/components/dashboard/AnalyticsDashboard").then(mod => mod.AnalyticsDashboard), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse bg-muted rounded-lg" />,
});

export { AnalyticsDashboardLazy };

function ForceLightTheme() {
  const { setTheme } = useTheme();
  
  useEffect(() => {
    setTheme("light");
  }, [setTheme]);
  
  return null;
}

function VisitorTracker() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useVisitorTracking();

  if (!mounted) return null;
  return null;
}

function DynamicFavicon() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useDynamicFavicon();

  if (!mounted) return null;
  return null;
}

function PerformanceMonitor() {
  // Only monitor in development or when explicitly enabled
  const shouldMonitor = process.env.NODE_ENV === 'development' || 
    typeof window !== 'undefined' && window.location.search.includes('perf-debug');
  
  usePerformanceMonitor(shouldMonitor);
  
  return null;
}

function RouteChangeHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [key, setKey] = useState(0);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Force re-render on route change to ensure components update properly
      setKey(prev => prev + 1);
    };

    router.events?.on('routeChangeComplete', handleRouteChange);
    
    return () => {
      router.events?.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <React.Fragment key={key}>
      {children}
    </React.Fragment>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
        <ForceLightTheme />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <AnalyticsProvider>
                <VisitorTracker />
                <DynamicFavicon />
                <PerformanceMonitor />
                <PandaBot />
                <ErrorBoundary>
                  <RouteChangeHandler>
                    <Component {...pageProps} />
                  </RouteChangeHandler>
                </ErrorBoundary>
              </AnalyticsProvider>
              <Toaster />
              <Sonner />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

