import {readFileSync} from 'node:fs'
import {databaseFingerprint,previewIsIsolated,assertSafeDatabaseWrite} from '../src/lib/launch-readiness'
import {getEncryptionKeyProblem} from '../src/lib/encryption'
export function cloudSandboxEnvironment():NodeJS.ProcessEnv{
 const config:Record<string,string>={}
 for(const line of readFileSync('.env.sandbox.local','utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m)continue;if(m[1] in config)throw new Error('Duplicate sandbox variable');let value=m[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);config[m[1]]=value}
 const sandbox=databaseFingerprint('postgresql://postgres@db.acocmsdnkpjfggycsxro.supabase.co/postgres'),shop=databaseFingerprint('postgresql://postgres@db.hddnabbhdjphjwjohvcg.supabase.co/postgres')
 if(config.APP_MODE!=='sandbox'||config.SANDBOX_DATABASE_FINGERPRINT!==sandbox||config.PRODUCTION_DATABASE_FINGERPRINT!==shop||!previewIsIsolated(config))throw new Error('Refusing non-sandbox database')
 if(getEncryptionKeyProblem(config.ENCRYPTION_KEY)||config.OLD_ENCRYPTION_KEY)throw new Error('Invalid sandbox encryption configuration')
 if(!config.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')||!config.CLERK_SECRET_KEY?.startsWith('sk_test_'))throw new Error('Only Clerk test instance allowed')
 const env:NodeJS.ProcessEnv={...process.env,...config,NODE_ENV:'development',VERCEL_ENV:'development',APP_MODE:'sandbox',ORDERS_ENABLED:'true',PAYMENTS_ENABLED:'false',LAUNCH_APPROVED:'false',NEXT_PUBLIC_SITE_URL:'http://localhost:3000',NEXT_PUBLIC_BASE_URL:'http://localhost:3000'}
 for(const key of ['EMAIL_USER','EMAIL_PASS','SMTP_HOST','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','TMN_RECEIVE_PHONE','PROMPTPAY_NUMBER','SLIPOK_API_KEY','SLIPOK_BRANCH_ID','SLIP_VERIFY_API_KEY','SLIP_VERIFY_API_URL','NEXT_PUBLIC_GA_ID','NEXT_PUBLIC_FB_PIXEL_ID'])env[key]=''
 const stripeTest = /^[rs]k_test_[A-Za-z0-9]+$/.test(config.STRIPE_SECRET_KEY || '')
 env.STRIPE_SECRET_KEY = stripeTest ? config.STRIPE_SECRET_KEY : ''
 env.STRIPE_ENABLED = stripeTest ? 'true' : 'false'
 env.STRIPE_WEBHOOK_SECRET = stripeTest ? config.STRIPE_WEBHOOK_SECRET || '' : ''
 assertSafeDatabaseWrite(env)
 return env
}
