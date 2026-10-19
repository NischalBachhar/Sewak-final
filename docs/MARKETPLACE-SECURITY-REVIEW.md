# Marketplace dependency review

The complete frontend npm audit is retained in `MARKETPLACE-DEPENDENCY-REVIEW.json`, including inherited dependency findings, paths, versions/ranges and individual advisories. There is no wildcard suppression and no claim that the full frontend toolchain audit is clean.

Compatible updates removed all critical findings. The browser runtime dependency audit and full Worker tooling audit each report zero vulnerabilities. The remaining full frontend audit contains 99 development/toolchain findings: 63 high, 33 moderate and 3 low. Build/test packages are correctly declared as development dependencies.

The machine review verifies every affected lockfile node is development-only and checks every production JavaScript source map for affected package paths. A missing source map, an affected runtime dependency, a failed audit response, or bundled affected code fails the review. The generated JSON records the exact lockfile hash and source counts.

The direct advisory families are build/test utilities: braces pattern parsing; node-forge development TLS; nth-check/SVGO handling of repository SVGs; PostCSS and selector parsing of repository CSS; serialize-javascript build metadata; sprintf-js and underscore/jsonpath reporting; uuid; webpack development server/middleware; and @tootallnate/once. Production uses precompiled React assets and a Cloudflare Worker, not a webpack development server. User uploads remain bounded JPEG/WebP binaries and are not compiled as repository SVG/CSS/code. No untrusted build input is introduced by this release.

Remaining development-toolchain risks still require maintenance. An eventual supported build-tool migration should have its own compatibility review. No forced downgrade to the audit suggestion `react-scripts@0.0.0`, forced dependency replacement, or audit bypass is used here.
