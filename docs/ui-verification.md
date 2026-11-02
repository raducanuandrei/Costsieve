# Integrated website verification

1 November 2026. Scope: the production Vite build in `apps/web`, preserving the owner's Lovable design. Filter mode: during, session override. Direction and reasons: `DESIGN.md`. ENERGY 2 / RHYTHM 2 / MOTION 2.

## Evidence

- `npm test`: production build and TypeScript checks for four workspaces; 63 tests passed.
- `npm run test:browser`: real Chrome extraction/engine harness passed, including real OCR and local-only static requests.
- `npm run test:site`: actual production website passed. CSV, Excel worksheet/mapping/European date-number choices, PDF confirmation, real PNG OCR, corrections across routes, source reconciliation, partial exclusions, pagination, scenarios, implementation cost, currency selection, failed usage recovery, guides, actual CSV/JSON downloads, print callback, reset/cancel, demo restart, keyboard focus and video pause were exercised.
- The site test applies the CSP from `_headers` to HTML responses and rejects remote requests, request bodies and document markers in URLs. No document-data requests or page errors occurred.
- Axe found zero violations in the tested report and informational routes. At 375px the route checks found no document overflow. 375px report and 1440px home/report screenshots were inspected visually. Reduced motion omits video and disables result animations.
- `npm audit`: zero known vulnerabilities. A separate code reviewer identified state/expiry defects; fixes have regression coverage.

## Antislop delivery gate

Each PASS refers to the built interface and the checks above, not an assertion about every possible document or browser.

### Hard gate

- R-02 PASS: source scan and rendered copy review found no em dash in website text; existing engine/CLI/export schema strings were preserved.
- R-03 PASS: automated 375px overflow checks plus mobile/desktop screenshot inspection.
- R-17 PASS: no customer counts, performance statistics or fabricated business savings in the site.
- R-18 PASS: no testimonials or fictional people.
- R-23 PASS: original owner-supplied favicon, hero image/video and navigation reused; no invented visual assets.
- R-24 PASS: all internal routes, including unknown-route fallback, loaded with one heading and no page errors.
- R-25 PASS: axe contrast checks passed on the tested pages; economic colors and brighter navigation accent remain readable on the dark surfaces.
- R-26 PASS: interactive control types have real handlers/links; test:site exercises imports/options, review, pagination, scenarios, usage, guides, exports, print, reset/cancel and motion controls. Sponsorship is honestly marked unconfigured, without a dead payment button.
- R-27 PASS: empty report, loading/progress, cancellation, validation errors, partial coverage and demo restart states were exercised.
- R-28 PASS: no filler FAQ.
- R-32 PASS: native controls, visible focus ring, tested keyboard skip link; horizontally scrollable CSV example is keyboard focusable.
- R-33 PASS: application behavior and styles are implemented directly in repository source.
- R-34 PASS: no theme toggle; the supplied obsidian visual direction is retained.
- R-35 PASS: production build and recorded browser workflow passed; screenshots were inspected.
- R-36 PASS: no compliance certification, guaranteed security, guaranteed savings or unsupported performance claim.
- R-37 PASS: explicit supplied design direction and owner-selected filter mode recorded in DESIGN.md.
- R-38 PASS: synthetic demo is labeled; real features match tested handlers; no fictional business results.

### Purpose gate

- R-01 PASS: metallic gradients preserve the supplied industrial brand; plain dark inputs distinguish editing from actions.
- R-04 PASS: existing chart/search/slider/download icons identify their corresponding real functions, as recorded in DESIGN.md.
- R-06 PASS: existing display/body fonts preserve identity; mono figures support exact financial reading.
- R-07 PASS: existing faint hero grid belongs to the metallic sieve visual; no decorative grid added to forms.
- R-08 PASS: no decorative arrow on every action.
- R-09 PASS: no capsule/glow promotional badges; stage labels identify actual report context.
- R-10 PASS: blur limited to the supplied sticky header.
- R-12 PASS: card surfaces group decisions and metal-button shadows identify actions; reasons recorded in DESIGN.md.
- R-13 PASS: no simultaneous glow treatment across components.
- R-14 PASS: original feature layout is retained by explicit request; data forms and reports use their own content-driven structure.
- R-19 PASS: result changes use a 200ms transition; video has pause and reduced-motion fallback; idle icon floating removed.
- R-22 PASS: no generic generated illustration.

### Liveliness

- Dials PASS: ENERGY 2 / RHYTHM 2 / MOTION 2 are explicit and consistent with the supplied source.
- Focal point PASS: primary analysis action on landing, document confirmation in review, recorded amounts and scenario effect in results.
- Whitespace PASS: separates import, review, context and scenario decisions, visible in screenshots.
- Accent PASS: one restrained blue navigation accent; green/red reserved for economic meaning.
- Motif PASS: original metallic sieve, silver actions and layered C identity retained.
- Design read PASS: integration direction recorded before implementation in DESIGN.md and site-integration-plan.md.

### Craftsmanship and consistency

- C-1 PASS: major visual decisions have reasons recorded in DESIGN.md.
- C-2 PASS: no unlabelled dead interactions in the tested workflows.
- C-3 PASS: sections explain imports, evidence, assumptions, actions or voluntary support; unverified competitor comparison removed.
- C-4 PASS: errors, partial coverage, cancellation, navigation, mobile, reduced motion and keyboard entry were exercised.
- C-5 PASS: sample data labeled synthetic; no fabricated testimonials or achieved-savings claims.
- R-05 PASS: preserves the explicitly requested source composition; review/results follow actual document and financial content.
- R-11 PASS: metal action pills, bounded card surfaces and compact native fields have distinct consistent radii.
- R-15 PASS: actions name their task, including Review documents, Apply scenario and Export JSON.
- R-16 PASS: no inflated AI marketing copy.
- R-20 PASS: supplied layered C, sieve visual and industrial typography preserved.
- R-21 PASS: dark theme is the owner's supplied branding direction.
- R-29 PASS: neutral surfaces, blue accent and semantic green/red economic states.
- R-30 PASS: the owner's own website is the source; no third-party product clone introduced.
- R-31 PASS: palette, typography, spacing, cards, icons, grid and motion reasons recorded in DESIGN.md.

## Limits of this verification

Chrome desktop with a mobile viewport was tested; physical mobile devices, Safari, Firefox, screen-reader sessions, full WCAG certification and Lighthouse/production performance scores were not measured. Automated axe checks are not a full accessibility audit. Print callback and print styles were checked; no exported PDF renderer was independently validated. OCR uses synthetic test invoices and remains heuristic with mandatory human confirmation. Cloudflare itself was not deployed; production response headers, deep links and worker/model files need the documented deployment smoke check. No real sponsorship payment destination is configured.

## Try with your AI addendum, 1 November 2026

The complete four-block gate above remains PASS for the current website. The approved visual direction is retained; DESIGN.md records reasons for the preview, section boundaries, native controls and separate names opt-in. No new logo, navigation scheme, motion treatment, color palette, icon set or unsupported product claim was introduced.

- R-02 PASS: source scan found no em dash in the new page, brief builder or skill copy.
- R-03 PASS: production Chrome test checked all routes at 375px, including /your-ai; 375px and 1440px screenshots of the new page were visually inspected.
- R-24 PASS: homepage/report links reach /your-ai; setup guidance and the real static skill download are usable; all existing routes and fallback still load.
- R-25 PASS: axe found zero violations on the new page and all tested routes under the production content policy.
- R-26 PASS: report inclusion, currency/names choices, preview, copy, real Markdown download and ZIP download have working handlers exercised in test:site. Download text equals the displayed preview; copy receives that same text.
- R-27 PASS: no-report use, blocked pending scenario edits, consent invalidation, omitted mismatched-currency scenarios, copy success and clipboard-denial fallback were exercised. Generic instructions remain usable without sensitive report data.
- R-32 PASS: native labeled inputs/select/textarea/buttons preserve keyboard access and existing visible focus; automated label queries locate each new control. No custom keyboard interaction was added.
- R-35 PASS: final production build/type check and test:site passed; test:browser also passed. Current complete build/test suite passed 68/68 tests. Network observation found only permitted local static GETs and no business-data requests or page errors.
- R-36 PASS: the page states provider capabilities/privacy limits and differentiates proposed effects from carried-out actions; no fake sign-in, assured savings or local-model claim is displayed.
- R-37 PASS: existing user-supplied direction, during-mode session choice and ENERGY 2 / RHYTHM 2 / MOTION 2 remain recorded in DESIGN.md.
- R-38 PASS: the feature matches tested behavior; fictional skill evaluations are labeled as simulations in skill-validation.md.
- C-1 PASS: the new layout/preview/label decisions have specific reasons in DESIGN.md.
- C-2 PASS: every new control is exercised, including actual file downloads and blocked-copy fallback.
- C-3 PASS: sections provide capability guidance, explicit data selection and the exact artifact; no filler or promotional section was added.
- C-4 PASS: names/currency consent resets, no report, pending changes, currency mismatch, mobile overflow and copy failure are covered.
- C-5 PASS: copy makes no fabricated customer, savings, performance or certification claim.

Updated screenshots are local verification artifacts: reports/site-your-ai-mobile.png and reports/site-your-ai-desktop.png. The earlier verification limitations still apply. No live AI-provider/accounting connector integration or Cloudflare deployment was performed by this test.

## Security regression addendum, 2 November 2026

The approved interface and four-block PASS gate above are retained. This change modifies import validation and response headers; it adds no visual assets, layout, navigation or product claims.

- R-24 / R-26 PASS: the final production-site test completed the existing imports, OCR, review, navigation, AI handoff, scenarios, downloads, print callback, cancellation and reset flows with every configured security header emulated on all static responses.
- R-25 / R-32 PASS: all-route mobile overflow/axe checks, keyboard entry and existing native labels passed under the updated policies.
- R-35 PASS: the final full build/test run passed 75/75 tests; the real browser integration harness and production-site test both passed after the ZIP consistency fix.
- R-36 / C-5 PASS: a synthetic vendor containing HTML-like markup created no image element or script effect; the actual CSV download preserved the formula-looking label as text. No production security certification or live Cloudflare configuration is claimed.
- C-4 PASS: invalid document checks preserve explicit error/review states; malformed or ambiguous workbooks cannot silently substitute worksheet amounts. Ordinary streamed ZIP data-descriptor entries and real OCR fixtures still pass.

These are local/browser regression checks. Public HTTPS probing returned Cloudflare 525 and the application headers were not present on that error response. The separate apex scan-path rule was later validated/deployed in the existing Cloudflare session and shown as Block/Active; /.env returned 403 while / retained 525. Production TLS/routing, other edge configuration, successful application responses and private vulnerability reporting remain unverified account-side items documented in SECURITY.md and cloudflare.md.
