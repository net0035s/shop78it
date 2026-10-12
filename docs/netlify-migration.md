# Netlify migration — 12 October 2026

## Current deployment

Public closed sandbox: https://shop78it.netlify.app. Netlify site ID `1d1c3222-a3ce-4ad2-a38c-bae6a324f56c`, team `november-3-cr7mw`, Free credit plan, automatic top-ups off. Deployment `6acd053755916f70756a1ee4` has the Next.js server handler, middleware and disabled maintenance function. Actual HTTP verification passed seven groups; see `netlify-smoke-latest.json`. Order/stock/delivery/payment/notification counts remained unchanged during these checks. No external notifications were sent.

This was deployed through the authorized official CLI, not automatic GitHub deployment. `main` and Vercel Production were not changed. Connecting GitHub automatic deployments remains a separate step; use the reviewed branch, never the stale main branch.

Build locally in an isolated temporary directory outside this Git checkout. The CLI resolves its internal function root from the repository root; a nested `.cache` staging directory uploaded user functions but omitted the Next.js handler, causing 404. The deployment tool now explicitly verifies the uploaded server handler before recording success. Prisma includes `rhel-openssl-3.0.x` for Lambda and the functions runtime is pinned to Node 22 with `AWS_LAMBDA_JS_RUNTIME`.

Next validation: signed-in admin behavior on the new host, a distinct Stripe test webhook endpoint, sandbox checkout/delivery and maintenance. Orders, Stripe, payments, messages and maintenance remain disabled until those test flows are set up. This is not real-launch approval.

Use `netlify-migration`, not the old `main` branch, for the first import. The reviewed runtime changes from the local working tree are included in this branch. Vercel Production is unchanged.

Build: `npm run build`; publish: `.next`; base directory empty; functions: `netlify/functions`; Node 22. Netlify automatically supplies its Next.js adapter. No database migrations run during builds.

Import the local ignored `.env.netlify.local` through Netlify Environment variables. This contains ONLY the isolated sandbox database configuration and Clerk test keys. Do not upload this file to GitHub, chat, or Netlify Drop. Do not import the ordinary `.env` (old source database credentials) or the Vercel Production environment.

First deploy stays closed: orders, real payments, Stripe, external messages and maintenance are disabled. The existing Vercel Stripe webhook signing secret must not be reused for a new endpoint. Stripe sandbox needs a new endpoint after the Netlify URL exists.

Netlify context and URL are captured at build time as nonsecret SHOP metadata, so runtime safety checks, receipt links and redirects resolve consistently. A Netlify sandbox remains isolated even when published to its temporary primary netlify.app URL. A preview may never use the shop database or live Stripe keys.

The maintenance function is scheduled every five minutes but returns immediately until MAINTENANCE_ENABLED=true. Enabling it requires a tested endpoint, matching CRON_SECRET, correct isolated database and notification review. Scheduled functions run on published Production deploys, not previews. Even a disabled scheduled invocation consumes some platform usage.

Validate actual deployed storefront/admin/lookup isolation and payment closures first. Then enable sandbox orders explicitly, configure the new Stripe test webhook, test cards and PromptPay, delivery/manual status updates and repeat purchases. Real launches require the separate launch checklist; free hosting does not open real payments.

Do not modify 2fa-go. Team credits are shared; monitor remaining usage before publishing. Never delete an existing project or change team billing as part of this migration.

Local checks are separate from deployed Netlify verification. This document does not claim that a Netlify project has been deployed or that notifications have been delivered.
