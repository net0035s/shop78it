# Netlify migration — 12 October 2026

## Current deployment

Public test sandbox: https://shop78it.netlify.app. Netlify site ID `1d1c3222-a3ce-4ad2-a38c-bae6a324f56c`, team `november-3-cr7mw`, Free credit plan, automatic top-ups off. Deployment `6acda44103db34aa2309ef23` enables sandbox orders and Stripe test payments with a dedicated Netlify test webhook. Real payments, launch approval, external messages and maintenance remain disabled. The original closed deployment passed seven HTTP groups in `netlify-smoke-latest.json`; that report records the earlier closed phase, not the current order gate.

This was deployed through the authorized official CLI, not automatic GitHub deployment. `main` and Vercel Production were not changed. Connecting GitHub automatic deployments remains a separate step; use the reviewed branch, never the stale main branch.

Build locally in an isolated temporary directory outside this Git checkout. The CLI resolves its internal function root from the repository root; a nested `.cache` staging directory uploaded user functions but omitted the Next.js handler, causing 404. The deployment tool now explicitly verifies the uploaded server handler before recording success. Prisma includes `rhel-openssl-3.0.x` for Lambda and the functions runtime is pinned to Node 22 with `AWS_LAMBDA_JS_RUNTIME`.

Two owner-created Netlify test orders have now completed payment at Stripe and are verified in the database as `needs_manual_delivery`, which is correct for the MOCK Manual Delivery product. Tracking reflects both statuses. Next validation is the repaired receipt page, manual admin delivery updates and automatic-goods delivery. This is not real-launch approval.

Deployed sandbox verification passed six groups in `netlify-stripe-sandbox-latest.json`: two distinct new orders and Checkout sessions, retry idempotency, THB/card/PromptPay/test-mode settings and Netlify return links, signature rejection and signed-event acceptance, active dedicated webhook, and cancelled fixtures with stock restored. No payment was completed in these automated checks; webhook signature verification does not by itself prove a successful payment's end-to-end delivery.

Use `netlify-migration`, not the old `main` branch, for the first import. The reviewed runtime changes from the local working tree are included in this branch. Vercel Production is unchanged.

Build: `npm run build`; publish: `.next`; base directory empty; functions: `netlify/functions`; Node 22. Netlify automatically supplies its Next.js adapter. No database migrations run during builds.

Always deploy through a full build so the adapter publishes `.netlify/static` and server functions together. An unqualified `--no-build` deploy used raw `.next` from TOML, leaving all public `/_next` chunks at 404. Previously cached pages appeared to work, but navigation after Stripe failed. Verification now fetches referenced JavaScript and CSS from storefront, checkout, receipt and tracking HTML, in addition to checking the server handler and Stripe configuration.

Import the local ignored `.env.netlify.local` through Netlify Environment variables. This contains ONLY isolated sandbox configuration, Clerk test keys and Stripe test credentials. Do not upload this file to GitHub, chat, or Netlify Drop. Do not import the ordinary `.env` (old source database credentials) or the Vercel Production environment. Do not rerun `prepare-netlify.ts` after enabling Stripe: it regenerates the initial closed configuration.

First deploy stays closed: orders, real payments, Stripe, external messages and maintenance are disabled. The existing Vercel Stripe webhook signing secret must not be reused for a new endpoint. Stripe sandbox needs a new endpoint after the Netlify URL exists.

Netlify context and URL are captured at build time as nonsecret SHOP metadata, so runtime safety checks, receipt links and redirects resolve consistently. A Netlify sandbox remains isolated even when published to its temporary primary netlify.app URL. A preview may never use the shop database or live Stripe keys.

The maintenance function is scheduled every five minutes but returns immediately until MAINTENANCE_ENABLED=true. Enabling it requires a tested endpoint, matching CRON_SECRET, correct isolated database and notification review. Scheduled functions run on published Production deploys, not previews. Even a disabled scheduled invocation consumes some platform usage.

Validate actual deployed storefront/admin/lookup isolation and payment closures first. Then enable sandbox orders explicitly, configure the new Stripe test webhook, test cards and PromptPay, delivery/manual status updates and repeat purchases. Real launches require the separate launch checklist; free hosting does not open real payments.

Do not modify 2fa-go. Team credits are shared; monitor remaining usage before publishing. Never delete an existing project or change team billing as part of this migration.

Local checks are separate from deployed Netlify verification. The recorded deployment is public and verified; no external notifications have been delivered during these checks.

13 October checkout/admin fixes: paid receipt reconciliation removes purchased cart quantities once per order and preserves later purchases, including after browser reload. Order numbers display in full with a clipboard button. Manual-delivery counts and actionable-order badges come from an unfiltered orders summary, independently of dashboard-statistics availability. The admin page refreshes every 15 seconds while visible and on focus, and reports statistics errors instead of silently displaying zero. Statistics queries use bounded batches to avoid exhausting database connections. Browser regression checks passed seven cases; commerce tests passed 28; deployed storefront assets (19) and admin assets (7) were reachable. The isolated database confirmed three manual-delivery/actionable orders at verification time. See netlify-checkout-admin-fixes.json.
