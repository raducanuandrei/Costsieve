# Deploy CostSieve on Cloudflare Pages

The production site is a static Vite/React application. The original TanStack Start/Lovable build wrapper was replaced with Vite and TanStack Router. No server, Supabase account, secrets or paid model service is required for this local analysis workflow.

Connect only the `raducanuandrei/Costsieve` repository to Cloudflare Pages:

- Production branch: the branch containing this integration (`feat/document-analysis` until the pull request is merged; then `main`).
- Root directory: repository root (leave blank).
- Build command: `npm run build`.
- Build output directory: `apps/web/dist`.
- Environment variable: `NODE_VERSION=24`.
- Framework preset: None.

The root build prepares and copies the PDF worker, OCR worker/WASM and English/Romanian models. Do not deploy just the HTML/JS files or omit `costsieve-assets`. `_redirects` supports direct routes such as `/analyze`; `_headers` supplies the same-origin content policy and security headers. There is no upload API or document persistence.

Before publishing, preview `/analyze`, import a small ledger, confirm a PDF invoice, run an image through OCR, apply a scenario, export it and reset. Verify that requests for workers/models return their actual files and that there are no blocked worker/WASM requests. Local browser tests verify these flows; Cloudflare production headers and routing still need this final deployment smoke check.

The sponsor section deliberately has no payment destination until the owner supplies one. The original Lovable repository remains separate and is not modified or connected to the canonical repository. Future Lovable design changes must be transferred and reviewed manually.

Platform reference: [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [Node version configuration](https://developers.cloudflare.com/pages/configuration/build-image/), [SPA serving](https://developers.cloudflare.com/pages/configuration/serving-pages/) and [response headers](https://developers.cloudflare.com/pages/configuration/headers/).
