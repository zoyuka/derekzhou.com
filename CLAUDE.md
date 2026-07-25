# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.css              All styles
/site.js                Email obfuscation only
/404.html               Custom 404 page
/assets/favicon.png     Black circle favicon (32x32)
/assets/fonts/          Self-hosted WOFF2 files
/robots.txt             Allow search engines, block AI crawlers
/.well-known/security.txt  Vulnerability reporting
/\_headers               Cloudflare Pages security headers
/\_redirects             HTTPS enforcement
/\_routes.json           Scopes Pages Functions to /private/* only
/.github/workflows/validate.yml  CI checks

Private area (not part of the public site, not linked from it):

/private/SETUP.md       How to configure the Access gate. Read before deploying.
/private/sysco/         Sysco Trace app (see its README)
/functions/private/\_middleware.js  Access JWT verification for all of /private/\*

Anything under /private/ is served only to a verified Cloudflare Access identity on
the ACCESS\_ALLOWED\_EMAILS allowlist. The middleware fails closed: if the
ACCESS\_TEAM\_DOMAIN / ACCESS\_AUD / ACCESS\_ALLOWED\_EMAILS environment variables
are absent, every request under /private/ gets a 404. Never weaken this to "allow
when unconfigured", and never add a client-side password gate — static content
reaches the browser before any client-side check can run.

The public site stays pure static HTML/CSS/JS. Functions exist only to guard
/private/\*, which is what \_routes.json enforces.

## Content

Name: Derek Zhou
Role: Product Manager
Bio first sentence (bold): "Derek is a Product Manager"
Bio rest (dimmed): "who leads with clarity, empathy, and genuine enthusiasm
for product and the outcomes it enables. He is accountable for solving complex
product challenges across digital platforms with the perfect balance of user
value, business goals, and technical integrity."

Experience:

* Senior Analyst, Digital Products @ Accenture Song, 2025 – Now
* Analyst, Digital Products @ Accenture Song, 2022 – 2025

Links:

* Email: hello@derekzhou.com (obfuscated in HTML, assembled in JS)

## Design

Typography-driven minimalism. Two fonts: a serif for name/bio (Newsreader or
similar), a clean sans for UI text (DM Sans or similar). Self-hosted as WOFF2
with @font-face. System font fallbacks that look great without the custom fonts.

Light/dark mode via prefers-color-scheme + color-scheme property.
Light: warm off-white (#fafaf8). Dark: near-black (#111110).
cursor: crosshair on body.
Mobile responsive. Print styles that hide footer and set colors for print.
Custom ::selection colors matching the palette.
Focus-visible outlines for keyboard navigation.

## CSS

One file: style.css. Plain CSS. Custom properties for theming.
All @font-face declarations at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all dimmed text in both modes.

## JS

One file: site.js. One job only:

1. Email obfuscation: HTML has href="#" id="email-link", JS assembles mailto
   from split parts at runtime so bots cannot scrape the address.
   A \<noscript\> fallback shows the email in HTML entities.

## SEO

Canonical URL, Open Graph tags, Twitter card meta, JSON-LD Person schema.
Title: "Derek Zhou — Product Manager".
Font preloads for Newsreader-Regular and DMSans-Regular.

## Security

All content directly in HTML. No innerHTML. No JS-generated DOM.
External JS and CSS files (enables strict CSP with no unsafe-inline).
\_headers file: script-src 'self'; style-src 'self'; connect-src 'none'; frame-ancestors 'none'.
HTML cache: max-age=0, must-revalidate. CSS/JS/assets: max-age=31536000, immutable.
robots.txt blocks: GPTBot, ClaudeBot, CCBot, Google-Extended, ChatGPT-User,
Bytespider, anthropic-ai, cohere-ai, FacebookBot.

## Deploy

Cloudflare Pages. Auto-deploys on push to main. No build command needed.
