# Deploy CostSieve on Cloudflare

The production site is a static Vite/React application. The original TanStack Start/Lovable build wrapper was replaced with Vite and TanStack Router. No server, Supabase account, secrets or paid model service is required for this local analysis workflow.

Connect only the `raducanuandrei/Costsieve` repository. The existing `costsieve` project uses Workers Builds; Pages is also supported as an alternative. Both serve the same static build without a PHP server or document API.

## Existing Workers project: costsieve

- Production branch: `main` after PR #1 is merged. Use `feat/document-analysis` only for an unmerged preview.
- Root directory: `/` (repository root).
- Build command: `npm run build`.
- Deploy command: `npx wrangler@4.156.1 deploy`.
- Node: 24, selected by the repository's `.node-version`; a pre-existing NODE_VERSION build variable takes precedence and must agree.

The root `wrangler.json` explicitly selects `apps/web/dist` as the static asset directory and native single-page application handling. It matches the existing Worker name `costsieve` and compatibility date. No application Worker script, account ID, credential, backend binding or domain change is required to package the site. Build must run before deploy; Wrangler does not replace the monorepo build command.

On 2 November the failed build was configured with production branch main, no build command, root `/` and `npx wrangler deploy`. The repository lacked a Wrangler asset configuration. These settings explain the missing static-directory error. The npm message about installing Wrangler is informational.

## Pages alternative

For a Pages project use:

- Production branch: the branch containing this integration (`feat/document-analysis` until the pull request is merged; then `main`).
- Root directory: repository root (leave blank).
- Build command: `npm run build`.
- Build output directory: `apps/web/dist`.
- Environment variable: `NODE_VERSION=24`.
- Framework preset: None.

The root build prepares and copies the PDF worker, OCR worker/WASM and English/Romanian models. Do not deploy just the HTML/JS files or omit `costsieve-assets`. Workers uses its configured native SPA fallback; Pages uses its default SPA behavior because there is no top-level 404.html. The former catch-all `_redirects` rewrite was removed after Wrangler reported it as an infinite loop. `_headers` supplies the same-origin content policy and security headers for static responses. There is no upload API or document persistence.

Before publishing, preview `/analyze`, import a small ledger, confirm a PDF invoice, run an image through OCR, apply a scenario, export it and reset. Verify that requests for workers/models return their actual files and that there are no blocked worker/WASM requests. Local browser tests verify these flows; Cloudflare production headers and routing still need this final deployment smoke check.

The sponsor section deliberately has no payment destination until the owner supplies one. The original Lovable repository remains separate and is not modified or connected to the canonical repository. Future Lovable design changes must be transferred and reviewed manually.

Platform reference: [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Node version configuration](https://developers.cloudflare.com/pages/configuration/build-image/), [SPA serving](https://developers.cloudflare.com/pages/configuration/serving-pages/) and [response headers](https://developers.cloudflare.com/pages/configuration/headers/).

Workers references: [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/), [SPA assets](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) and [static headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Security release checks

The repository build does not configure account settings. The local Wrangler check returned unauthenticated, but the existing browser session was later available. On 2 November 2026 a public HEAD request to https://costsieve.dev/ returned Cloudflare 525, not the built application. The request checked status/security headers only and used no credentials or business documents. [Error 525](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-525/) means the TLS handshake between Cloudflare and the current origin failed; the actual DNS origin and certificate still require account-side inspection. The narrow custom rule below was subsequently activated and verified; remaining TLS/routing and application-header checks are still pending.

1. Deploy/verify the built Pages project and associate costsieve.dev as its custom domain using Pages' domain setup. Inspect existing apex DNS/Worker routes before changing them; preserve unrelated records. Verify Pages and custom-domain certificate status, then require a successful application response on HTTPS. Keep origin encryption Full (strict); resolve the certificate/routing issue rather than reducing TLS protection.
2. Verify HTTP redirects to HTTPS, TLS 1.2 or newer, certificate renewal and the WAF protection available on the selected plan. Use the existing administrative account with MFA. Inspect recent Security Events by path, action and response status; request totals alone do not establish an incident. Do not introduce blanket bot challenges or global rate limits without evidence, because the public documentation, models and skill download must remain usable.
3. On the actual HTTPS responses, verify the headers from apps/web/public/_headers, including CSP, no-referrer, nosniff, DENY framing, same-origin opener/resource policy and Strict-Transport-Security: max-age=2592000. The HSTS policy applies to this host for 30 days; subdomains/preload are intentionally excluded. The local site test emulates all these headers on static responses; only a real deployment can prove Cloudflare is applying them.
4. Run the document/OCR/scenario/export/reset smoke flow on the deployed site and check that no document data leaves the browser. Check /analyze, /your-ai, the skill ZIP and worker/model assets directly. Avoid optional third-party script injection/analytics while processing private documents.

### Custom scan-path rule

For the CostSieve apex hostname, the following rule blocks common probes for services/files this static application does not serve. In Cloudflare's [custom rule editor](https://developers.cloudflare.com/waf/custom-rules/create-dashboard/), use the name `CostSieve unsupported scan paths`, action **Block**, and this expression. Adding this document alone does not enable it on another deployment. Preserve existing rules; validate the expression in the account before deploying. Extend the hostname set only after another hostname is deliberately configured.

```text
(http.host eq "costsieve.dev" and (
  lower(http.request.uri.path) in {"/.env" "/.git" "/wp-admin" "/wp-login.php" "/xmlrpc.php"}
  or starts_with(lower(http.request.uri.path), "/.env.")
  or starts_with(lower(http.request.uri.path), "/.git/")
  or starts_with(lower(http.request.uri.path), "/wp-admin/")
))
```

After applying, normal routes/assets must still return their expected responses; a request to a blocked probe should show the custom Block action in Security Events. Rollback is disabling this one rule. This narrow rule is additional noise reduction, not comprehensive exploit detection or a substitute for the application controls in [SECURITY.md](../SECURITY.md).

Verified application on 2 November 2026: Cloudflare validated the expression and the domain's custom-rules list showed `CostSieve unsupported scan paths`, **Block**, **Active**, 1/5 custom rules used. The existing leaked-credential rate rule remained active. A public HEAD to `/.env` returned **403**, while `/` remained **525**, consistent with the narrow path restriction and unresolved origin TLS. The domain overview showed no connected Worker. No DNS/TLS setting, other domain, broader bot challenge, account permission, paid plan or deployment was changed. Further browser interaction was deferred when concurrent user activity moved another application in front of the browser. Successful application routes and actual Security Events attribution still require the post-deployment checks above.
