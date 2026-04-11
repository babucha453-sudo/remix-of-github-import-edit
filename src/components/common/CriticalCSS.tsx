/**
 * CriticalCSS - Inlined critical styles for faster FCP
 * 
 * These styles are extracted from the main CSS and inlined
 * to eliminate render-blocking CSS for above-the-fold content.
 * 
 * Only include truly critical styles here - everything else
 * will be loaded asynchronously via the main stylesheet.
 */

export const CriticalCSS = () => (
  <style
    dangerouslySetInnerHTML={{
      __html: `
        /* Critical reset and base styles */
        *, *::before, *::after {
          box-sizing: border-box;
          border-width: 0;
          border-style: solid;
        }
        
        html {
          line-height: 1.5;
          -webkit-text-size-adjust: 100%;
          -moz-tab-size: 4;
          tab-size: 4;
          scroll-behavior: smooth;
        }
        
        body {
          margin: 0;
          line-height: inherit;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-weight: 500;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background-color: hsl(220 25% 97%);
          color: hsl(222 55% 11%);
        }
        
        /* Critical layout for initial paint */
        #root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        /* Font loading fallback - prevent FOIT */
        @font-face {
          font-family: 'Plus Jakarta Sans Fallback';
          src: local('Arial');
          size-adjust: 104%;
          ascent-override: 97%;
          descent-override: 26%;
          line-gap-override: 0%;
        }
        
        /* Loading skeleton animation */
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .skeleton {
          animation: skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          background-color: hsl(220 18% 92%);
          border-radius: 0.5rem;
        }
        
        /* Critical button styles */
        button {
          font-family: inherit;
          font-size: 100%;
          font-weight: inherit;
          line-height: inherit;
          color: inherit;
          margin: 0;
          padding: 0;
          text-transform: none;
          -webkit-appearance: button;
          background-color: transparent;
          cursor: pointer;
        }
        
        /* Critical link styles */
        a {
          color: inherit;
          text-decoration: inherit;
        }
        
        /* Critical image styles - prevent CLS */
        img, video {
          display: block;
          max-width: 100%;
          height: auto;
        }
        
        /* Critical heading styles */
        h1, h2, h3, h4, h5, h6 {
          font-size: inherit;
          font-weight: inherit;
          margin: 0;
        }
        
        /* Hide visually but keep for screen readers */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
        
        /* Loading spinner for Suspense fallback */
        .page-loader {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: hsl(220 25% 97%);
        }
        
        .page-loader-text {
          color: hsl(173 85% 36%);
          font-weight: 700;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }
      `,
    }}
  />
);

export default CriticalCSS;
