# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.css              All styles
/site.js                Scroll reveal + email obfuscation only
/assets/favicon.png     Black circle favicon (32x32)
/assets/fonts/          Self-hosted WOFF2 files
/robots.txt             Allow search engines, block AI crawlers
/.well-known/security.txt  Vulnerability reporting
/\_headers               Cloudflare Pages security headers
/\_redirects             HTTPS enforcement
/.github/workflows/validate.yml  CI checks

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

Light/dark mode via prefers-color-scheme.
Light: warm off-white (#fafaf8). Dark: near-black (#111110).
cursor: crosshair on body.
Subtle scroll-reveal on sections via IntersectionObserver.
Disabled under prefers-reduced-motion.
Mobile responsive. Print styles that hide footer.

## CSS

One file: style.css. Plain CSS. Custom properties for theming.
All @font-face declarations at top of file.

## JS

One file: site.js. Two jobs only:

1. Email obfuscation: HTML has href="#" id="email-link", JS assembles mailto
   from split parts at runtime so bots cannot scrape the address.
2. Scroll reveal: IntersectionObserver adds .visible class to \[data-reveal]
   sections with staggered delays.

## Security

All content directly in HTML. No innerHTML. No JS-generated DOM.
External JS and CSS files (enables strict CSP with no unsafe-inline).
\_headers file: script-src 'self'; style-src 'self'; frame-ancestors 'none'.
HTML cache: max-age=0, must-revalidate. Assets: max-age=31536000, immutable.
robots.txt blocks: GPTBot, ClaudeBot, CCBot, Google-Extended, ChatGPT-User,
Bytespider, anthropic-ai, cohere-ai, FacebookBot.

## Deploy

Cloudflare Pages. Auto-deploys on push to main. No build command needed.

