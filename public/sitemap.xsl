<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">

  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html>
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Sitemap • AppointPanda</title>
        <style>
          :root {
            --bg: #0b1220;
            --card: rgba(255,255,255,.06);
            --border: rgba(255,255,255,.10);
            --text: rgba(255,255,255,.92);
            --muted: rgba(255,255,255,.62);
            --accent: #0d9488;
          }
          body { margin: 0; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif; background: radial-gradient(1200px 600px at 15% 0%, rgba(13,148,136,.20), transparent 60%), radial-gradient(900px 500px at 85% 10%, rgba(56,189,248,.16), transparent 60%), var(--bg); color: var(--text); }
          .wrap { max-width: 1100px; margin: 0 auto; padding: 28px 16px 56px; }
          .top { display:flex; align-items:baseline; justify-content:space-between; gap: 12px; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 20px; letter-spacing: .2px; }
          .meta { color: var(--muted); font-size: 13px; }
          .card { background: var(--card); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; }
          .row { display:flex; gap: 12px; align-items:center; justify-content:space-between; padding: 14px 16px; border-top: 1px solid var(--border); }
          .row:first-child { border-top: 0; }
          a { color: var(--text); text-decoration: none; }
          a:hover { text-decoration: underline; }
          .pill { display:inline-flex; align-items:center; gap: 8px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border); background: rgba(255,255,255,.04); color: var(--muted); font-size: 12px; }
          .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--accent); box-shadow: 0 0 0 3px rgba(13,148,136,.18); }
          .name { display:flex; flex-direction:column; gap: 4px; min-width: 0; }
          .loc { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 74ch; }
          .sub { color: var(--muted); font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="top">
            <h1>AppointPanda Sitemap</h1>
            <div class="pill"><span class="dot"/>XML + clickable view</div>
          </div>

          <xsl:choose>
            <xsl:when test="s:sitemapindex">
              <div class="meta">This is a sitemap index. Click a sitemap below to open it.</div>
              <div class="card" style="margin-top: 12px;">
                <xsl:for-each select="s:sitemapindex/s:sitemap">
                  <div class="row">
                    <div class="name">
                      <div class="loc">
                        <a>
                          <xsl:attribute name="href"><xsl:value-of select="s:loc"/></xsl:attribute>
                          <xsl:value-of select="s:loc"/>
                        </a>
                      </div>
                      <div class="sub">
                        <xsl:text>Last modified: </xsl:text>
                        <xsl:value-of select="s:lastmod"/>
                      </div>
                    </div>
                    <div class="pill">Open</div>
                  </div>
                </xsl:for-each>
              </div>
            </xsl:when>

            <xsl:when test="s:urlset">
              <div class="meta">This is a URL sitemap. Click any URL below.</div>
              <div class="card" style="margin-top: 12px;">
                <xsl:for-each select="s:urlset/s:url">
                  <div class="row">
                    <div class="name">
                      <div class="loc">
                        <a>
                          <xsl:attribute name="href"><xsl:value-of select="s:loc"/></xsl:attribute>
                          <xsl:value-of select="s:loc"/>
                        </a>
                      </div>
                      <div class="sub">
                        <xsl:if test="s:lastmod">
                          <xsl:text>Last modified: </xsl:text><xsl:value-of select="s:lastmod"/>
                          <xsl:text> • </xsl:text>
                        </xsl:if>
                        <xsl:text>Changefreq: </xsl:text><xsl:value-of select="s:changefreq"/>
                        <xsl:text> • Priority: </xsl:text><xsl:value-of select="s:priority"/>
                      </div>
                    </div>
                    <div class="pill">Open</div>
                  </div>
                </xsl:for-each>
              </div>
            </xsl:when>

            <xsl:otherwise>
              <div class="meta">Unknown sitemap format.</div>
            </xsl:otherwise>
          </xsl:choose>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
