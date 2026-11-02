# Approved site integration

Owner authorized pushing Costsieve and manually integrating the Lovable-built site; owner will deploy Cloudflare. Existing core commit f3d2cef has been pushed to feat/document-analysis. Do not deploy, alter DNS, install Lovable apps or write to motion-layer-mosaic.

Implementation: transfer the existing routes, shell, typography, hero image/video and style tokens into apps/web. Use official Vite/TanStack Router SPA tooling, replacing the Lovable TanStack Start build wrapper and all Lovable telemetry. Calculations and document extraction remain client-only; no SSR/backend is needed. Cloudflare Pages can serve apps/web/dist with SPA fallback. Fonts, original media and OCR assets are self-hosted.

Wire one in-memory AnalysisSession through application context. Implement select/import options -> source/field review -> explicit invoice confirmation/reconciliation/exclusions -> engine report, context questions, exact-record action scenarios, local exports and reset. Demo runs the same engine on synthetic fixtures. /report uses the same active session or an honest empty state.

Preserve visual identity; use semantic green/red for positive/negative results, signed values and estimated labels, 200ms transform/opacity transitions with reduced-motion fallback. Existing source comparison claims are replaced by factual methodology. Sponsorship remains nonblocking with no invented donation destination.

Test first with actual site browser workflows; then retain the 60 core tests, run production build and audits, route/deep-link/mobile/keyboard/reduced-motion and network/privacy tests, accessibility checks and independent final integration review. Push final code to Costsieve; no Cloudflare publication.
