import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  showNavbar?: boolean;
  showFooter?: boolean;
}

export const PageLayout = ({ 
  children, 
  className,
  showNavbar = true,
  showFooter = true 
}: PageLayoutProps) => {
  return (
    <div className={cn("min-h-screen bg-background flex flex-col overflow-x-hidden", className)}>
      {showNavbar && <Navbar />}
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
};
