import Document, { Head, Html, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <meta charSet="UTF-8" />
          <meta name="author" content="AppointPanda" />

          {/* SEO AUDIT FIX: Default robots tag as failsafe */}
          <meta name="robots" content="index, follow" />

          {/* DNS Prefetch for external domains */}
          <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
          <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
          <link rel="dns-prefetch" href="https://images.unsplash.com" />

          {/* Preconnect to critical origins */}
          <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

          {/* Favicon */}
          <link rel="icon" type="image/png" href="/favicon.png?v=5" />
          <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png?v=5" />
          <link rel="manifest" href="/site.webmanifest?v=5" />

          {/* Theme color */}
          <meta name="theme-color" content="#0d9488" />

          {/* Google Search Console Verification */}
          <meta name="google-site-verification" content="QXeUyCI6vHRD4bv5ZLJCYQVSvESe4uqju4tWaamlr2A" />

          {/* Geo targeting */}
          <meta name="geo.region" content="US" />

          {/* Font - preconnect and load with display=swap to prevent FOIT */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
            rel="stylesheet"
          />

          {/* Organization Schema */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "AppointPanda",
                url: "https://www.appointpanda.com",
                logo: "https://www.appointpanda.com/logo.png",
                description: "Find and book appointments with top-rated dental professionals",
              }),
            }}
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
