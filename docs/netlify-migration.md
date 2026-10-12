# Netlify migration — 12 October 2026

## Current deployment

Public test sandbox: https://shop78it.netlify.app. Netlify site ID `1d1c3222-a3ce-4ad2-a38c-bae6a324f56c`, team `november-3-cr7mw`, Free credit plan, automatic top-ups off. Deployment `6acd0ea6db7caef51d006991` enables sandbox orders and Stripe test payments with a dedicated Netlify test webhook. Real payments, launch approval, external messages and maintenance remain disabled. The original closed deployment passed seven HTTP groups in `netlify-smoke-latest.json`; that report records the earlier closed phase, not the current order gate.

This was deployed through the authorized official CLI, not automatic GitHub deployment. `main` and Vercel Production were not changed. Connecting GitHub automatic deployments remains a separate step; use the reviewed branch, never the stale main branch.

Build locally in an isolated temporary directory outside this Git checkout. The CLI resolves its internal function root from the repository root; a nested `.cache` staging directory uploaded user functions but omitted the Next.js handler, causing 404. The deployment tool now explicitly verifies the uploaded server handler before recording success. Prisma includes `rhel-openssl-3.0.x` for Lambda and the functions runtime is pinned to Node 22 with `AWS_LAMBDA_JS_RUNTIME`.

Next user validation: complete a Stripe test card and simulated PromptPay payment, check delivery/manual status updates and repeat purchases, then signed-in admin behavior on the new host. Creating a test Checkout session and verifying its settings is separate from completing a payment. This is not real-launch approval.

Deployed sandbox verification passed six groups in `netlify-stripe-sandbox-latest.json`: two distinct new orders and Checkout sessions, retry idempotency, THB/card/PromptPay/test-mode settings and Netlify return links, signature rejection and signed-event acceptance, active dedicated webhook, and cancelled fixtures with stock restored. No payment was completed in these automated checks; webhook signature verification does not by itself prove a successful payment's end-to-end delivery.

Use `netlify-migration`, not the old `main` branch, for the first import. The reviewed runtime changes from the local working tree are included in this branch. Vercel Production is unchanged.

Build: `npm run build`; publish: `.next`; base directory empty; functions: `netlify/functions`; Node 22. Netlify automatically supplies its Next.js adapter. No database migrations run during builds.

Import the local ignored `.env.netlify.local` through Netlify Environment variables. This contains ONLY isolated sandbox configuration, Clerk test keys and Stripe test credentials. Do not upload this file to GitHub, chat, or Netlify Drop. Do not import the ordinary `.env` (old source database credentials) or the Vercel Production environment. Do not rerun `prepare-netlify.ts` after enabling Stripe: it regenerates the initial closed configuration.

First deploy stays closed: orders, real payments, Stripe, external messages and maintenance are disabled. The existing Vercel Stripe webhook signing secret must not be reused for a new endpoint. Stripe sandbox needs a new endpoint after the Netlify URL exists.

Netlify context and URL are captured at build time as nonsecret SHOP metadata, so runtime safety checks, receipt links and redirects resolve consistently. A Netlify sandbox remains isolated even when published to its temporary primary netlify.app URL. A preview may never use the shop database or live Stripe keys.

The maintenance function is scheduled every five minutes but returns immediately until MAINTENANCE_ENABLED=true. Enabling it requires a tested endpoint, matching CRON_SECRET, correct isolated database and notification review. Scheduled functions run on published Production deploys, not previews. Even a disabled scheduled invocation consumes some platform usage.

Validate actual deployed storefront/admin/lookup isolation and payment closures first. Then enable sandbox orders explicitly, configure the new Stripe test webhook, test cards and PromptPay, delivery/manual status updates and repeat purchases. Real launches require the separate launch checklist; free hosting does not open real payments.

Do not modify 2fa-go. Team credits are shared; monitor remaining usage before publishing. Never delete an existing project or change team billing as part of this migration.

Local checks are separate from deployed Netlify verification. The recorded deployment is public and verified; no external notifications have been delivered during these checks.
