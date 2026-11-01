# Third-party dependencies

New CostSieve code is MIT-licensed. Dependencies retain their own licenses and notices. The pinned dependency graph is in package-lock.json; npm packages include upstream license metadata/files.

Core runtime dependencies include decimal.js and Papa Parse (their full notices are in packages/engine/THIRD_PARTY_NOTICES.md), read-excel-file, fflate, PDF.js, Tesseract.js and its WASM core, English/Romanian language packages, @napi-rs/canvas, the official Model Context Protocol TypeScript SDK, and Zod.

The asset preparation script copies upstream provided license/notice/readme/package metadata alongside the generated PDF/OCR worker and model assets. Preserve the generated assets/licenses directory when transferring browser assets or redistributing a bundle. Do not replace third-party attribution with the project's copyright. Native package notices remain with their installed packages.

The private development package configuration does not publish software or assets automatically. Review dependency notices as part of any public release.
