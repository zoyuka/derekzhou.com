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
/\_routes.json           Scopes Pages Functions to /api/* only
/.github/workflows/validate.yml  CI checks

Side project, publicly reachable but not linked from the home page:

/sysco/                 Sysco Trace app (see sysco/README.md)
/functions/api/         Live search endpoint backing it

Reachable by anyone with the URL. Kept out of search results via X-Robots-Tag in
\_headers plus a noindex meta tag; delete both to make it indexable. It needs
connect-src 'self' in its CSP block because the site-wide policy sets
connect-src 'none', which would block it fetching its own JSON.

The home page stays pure static HTML/CSS/JS with no build step. Functions exist only
to back /sysco/, which \_routes.json enforces by scoping them to /api/\*.

The /api/search menu parameter fetches a URL supplied by the visitor. Every guard in
functions/api/lib/http.js is load-bearing — https only, no private or link-local hosts,
redirects re-validated per hop, byte ceiling while streaming. Without them the endpoint
is an SSRF pivot and an open proxy. Never relax them, and never return the fetched body. If this page ever
needs real access control, it must be enforced at the edge (Cloudflare Access, or a
Pages Function) — never with a client-side password check, because static content
reaches the browser before any client-side check can run.

## Content

Name: Derek Zhou
Role: Product Manager
Bio first sentence (bold): "Derek is a Product Manager"
Bio rest (dimmed): "who leads with clarity, empathy, and genuine enthusiasm
for product and the outcomes it enables. He is accountable for solving complex
product challenges across digital platforms with the perfect balance of user
value, business goals, and technical integrity."

Experience:

* Product Team Lead @ Accenture Song, 2022 – Now
* Product Intern @ Sabre, 2020

Job title, company, and dates only. No per-role project or client lists.

Links:

* Email: hello@derekzhou.com (obfuscated in HTML, assembled in JS)
* LinkedIn: https://www.linkedin.com/in/derek-z (plain href, rel="me",
  also listed in the JSON-LD Person sameAs)

Both live in the footer, separated by footer a + a margin.

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
