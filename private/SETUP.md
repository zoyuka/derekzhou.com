# Locking down /private/

The page at `/private/sysco/` is gated by `functions/private/_middleware.js`, which
verifies a Cloudflare Access JWT at the edge before serving anything.

**Until you complete steps 1–3 below, the middleware denies every request**, including
yours. That is deliberate: an unconfigured deployment serves nothing rather than
everything.

---

## 0. Make the GitHub repository private — do this first

`zoyuka/derekzhou.com` is currently **public**. Every file in it, including
`/private/sysco/`, is readable by anyone at `github.com/zoyuka/derekzhou.com`,
and it is already indexed and forkable. No amount of edge authentication changes
this — Cloudflare Access protects the *website*, not the *source*.

Settings → General → Danger Zone → Change repository visibility → Private.

Cloudflare Pages keeps deploying normally after the switch; the existing GitHub
integration retains access. If a build fails afterwards, reconnect the repo under
Workers & Pages → your project → Settings → Builds & deployments.

Because the current contents were public, treat anything already committed as
disclosed. Nothing here is a credential — the app holds only public-record data and
no secrets are stored in the repo — so there is nothing to rotate.

## 1. Create the Access application

Cloudflare dashboard → Zero Trust → Access → Applications → **Add an application** →
*Self-hosted*.

| Field | Value |
| --- | --- |
| Application name | `derekzhou private` |
| Session duration | `24 hours` (shorter is stricter) |
| Domain | `derekzhou.com`, path `private` |

Add a second domain entry for your `*.pages.dev` hostname too. The middleware
already blocks that route, but defence in depth costs nothing here.

## 2. Add the policy

Policy name `owner only`, action **Allow**, with a single rule:

- Include → **Emails** → `derekyz123@gmail.com`

Use `Emails`, not `Email domain`. A domain rule on a public mail provider would admit
every Gmail account in existence.

Under Authentication, enable **One-time PIN** at minimum. If you sign in to Cloudflare
with Google, add Google as an identity provider and require it — SSO with your existing
MFA is meaningfully stronger than emailed PINs, which are only as strong as your inbox.

## 3. Set the Pages environment variables

Copy the **Application Audience (AUD) Tag** from the Access app's Overview tab.

Workers & Pages → `derekzhou.com` → Settings → **Environment variables**. Add these to
**both** Production and Preview, and mark each one **Encrypt**:

| Variable | Value |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | `<your-team>.cloudflareaccess.com` |
| `ACCESS_AUD` | the AUD tag from step 2 |
| `ACCESS_ALLOWED_EMAILS` | `derekyz123@gmail.com` |

Set them on Preview as well. Preview deployments are publicly routable at
`<hash>.<project>.pages.dev`; if they are left unconfigured the middleware denies
everything there, which is safe, but you will not be able to test previews.

Redeploy for the variables to take effect.

## 4. Verify

```sh
# Should return 404 — never 200, and never any page content.
curl -sS -o /dev/null -w '%{http_code}\n' https://derekzhou.com/private/sysco/

# Same for the pages.dev hostname, which an Access policy alone would NOT cover.
curl -sS -o /dev/null -w '%{http_code}\n' https://<project>.pages.dev/private/sysco/

# Confirm nothing leaked into the body.
curl -sS https://derekzhou.com/private/sysco/ | head
```

Then open `https://derekzhou.com/private/sysco/` in a browser. You should be redirected
to a Cloudflare Access login, and land on the app after authenticating.

---

## Why it is built this way

**The pages.dev bypass.** An Access policy attached to `derekzhou.com` does not cover
`<project>.pages.dev` or per-deployment preview URLs. Those hostnames stay publicly
routable, and this is the most common way a "protected" Pages site turns out not to be.
The middleware runs on every hostname the project answers on, so it closes the hole
regardless of how the Access policy is scoped.

**Signature verification, not header trust.** The middleware validates the JWT's
RS256 signature against Cloudflare's published keys and pins the algorithm, rather than
trusting the presence of a header. Accepting `alg` from the token is the classic
forgery route (`alg: none`, or HS256 signed with the public key); both are tested
against.

**An allowlist on top of the policy.** Authentication proves who the visitor is;
the `ACCESS_ALLOWED_EMAILS` check decides whether that person may enter. A
misconfigured or overly broad Access policy still cannot admit anyone else.

**Fail closed everywhere.** Missing config, partial config, malformed token, expired
token, wrong audience, wrong issuer, unknown signing key, unexpected exception — all
deny. `functions/private/_middleware.test.js` signs real tokens with a generated
keypair and asserts each path, and CI runs it on every push.

**Uniform denials.** Every rejection returns an identical `404` with no body detail.
Distinguishing "wrong email" from "expired token" would turn the endpoint into an
oracle for probing the allowlist. The specific reason goes to a response header for
your logs only.

**No cache, anywhere.** Private responses set `no-store` so nothing lands in a browser
cache, a shared proxy, or Cloudflare's edge cache.

**Not listed in robots.txt.** Adding `Disallow: /private/` would publish a map of
exactly where the protected content lives, to a file designed to be read by anyone.
Unauthenticated crawlers get a 404 and an `X-Robots-Tag: noindex` instead, which
achieves the goal without the disclosure.

## What this does not protect against

- **A compromised Gmail account.** One-time PINs are delivered by email, so your inbox
  is the security boundary. Requiring Google SSO with MFA moves that boundary to your
  Google account, which is why step 2 recommends it.
- **Anyone with Cloudflare dashboard access**, who can simply change the policy.
- **The repository's history.** Making the repo private stops future reads; it does not
  retract what was already public.
