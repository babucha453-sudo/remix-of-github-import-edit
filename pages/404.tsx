import Link from "next/link";

export default function Custom404() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30">
      <div className="text-center px-4 max-w-md">
        {/* 404 Visual */}
        <div className="mb-6">
          <span className="text-8xl font-black bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">
            404
          </span>
        </div>
        
        <h1 className="mb-3 text-2xl font-bold text-foreground">
          Page Not Found
        </h1>
        
        <p className="mb-6 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Homepage
          </Link>
          
          <Link 
            href="/search/" 
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find a Dentist
          </Link>
        </div>
        
        {/* Helpful Links */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3">Popular destinations:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/ca/" className="text-xs text-primary hover:underline">California</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link href="/nj/" className="text-xs text-primary hover:underline">New Jersey</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link href="/ma/" className="text-xs text-primary hover:underline">Massachusetts</Link>
            <span className="text-muted-foreground/30">•</span>
            <Link href="/ct/" className="text-xs text-primary hover:underline">Connecticut</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
