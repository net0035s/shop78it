import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { cpSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { loadTransitionState, saveTransitionState } from './execute-source-transition'
async function main() {
  assert(process.argv.includes('--closed-production'),'Closed production confirmation required')
  loadEnvConfig(process.cwd(),true,{info(){},error(){}})
  const {state}=loadTransitionState();assert.equal(state.phase,'verified')
  const transition=JSON.parse(readFileSync('docs/launch-source-transition-latest.json','utf8'));assert(transition.passed&&transition.runtimeRoleVerified)
  const backup=JSON.parse(readFileSync('docs/launch-post-transition-backup-latest.json','utf8'));assert(backup.restoreVerified&&backup.businessTables===15&&backup.orders===26)
  const project=JSON.parse(readFileSync('.vercel/project.json','utf8'))
  assert.equal(project.projectId,'prj_7klbKPGuzckoZ5liEDP9UXQRxvcV');assert.equal(project.orgId,'team_vzgAheUA1bP7p02TJ8pUZvOb')
  const env:Record<string,string>={DATABASE_URL:state.runtimeUrl,DIRECT_URL:state.runtimeDirectUrl,ENCRYPTION_KEY:state.newKey,OLD_ENCRYPTION_KEY:'',APP_MODE:'live',ORDERS_ENABLED:'false',PAYMENTS_ENABLED:'false',LAUNCH_APPROVED:'false',
    STRIPE_ENABLED:'false',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',TMN_RECEIVE_PHONE:'',PROMPTPAY_NUMBER:'',SLIPOK_API_KEY:'',SLIPOK_BRANCH_ID:'',SLIP_VERIFY_API_KEY:'',SLIP_VERIFY_API_URL:'',
    NEXT_PUBLIC_SITE_URL:'https://shop78it.vercel.app',NEXT_PUBLIC_BASE_URL:'https://shop78it.vercel.app',NEXT_PUBLIC_SHOP_NAME:'Shop78it',NEXT_PUBLIC_SHOP_TAGLINE:process.env.NEXT_PUBLIC_SHOP_TAGLINE||'',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY||'',CLERK_SECRET_KEY:process.env.CLERK_SECRET_KEY||'',ADMIN_EMAILS:process.env.ADMIN_EMAILS||'',
    EMAIL_USER:process.env.EMAIL_USER||'',EMAIL_PASS:process.env.EMAIL_PASS||'',SMTP_HOST:process.env.SMTP_HOST||'',SMTP_PORT:process.env.SMTP_PORT||'',SMTP_SECURE:process.env.SMTP_SECURE||'',
    TELEGRAM_BOT_TOKEN:process.env.TELEGRAM_BOT_TOKEN||'',TELEGRAM_CHAT_ID:process.env.TELEGRAM_CHAT_ID||'',CRON_SECRET:state.closedEnvironment?.CRON_SECRET||randomBytes(32).toString('hex'),
    NEXT_PUBLIC_SUPPORT_EMAIL:process.env.NEXT_PUBLIC_SUPPORT_EMAIL||process.env.EMAIL_USER||'',NEXT_PUBLIC_LINE_URL:process.env.NEXT_PUBLIC_LINE_URL||'',NEXT_PUBLIC_GA_ID:'',NEXT_PUBLIC_FB_PIXEL_ID:'',
    SANDBOX_DATABASE_FINGERPRINT:'',PRODUCTION_DATABASE_FINGERPRINT:process.env.PRODUCTION_DATABASE_FINGERPRINT||'',BACKUP_RESTORE_VERIFIED:'true',MIGRATION_REHEARSAL_VERIFIED:'true',PROVIDER_SANDBOX_VERIFIED:'true',
    CLERK_ADMIN_VERIFIED:'false',MAINTENANCE_VERIFIED:'false',HOSTING_COMMERCIAL_CONFIRMED:'false',NEXT_TELEMETRY_DISABLED:'1',CLERK_TELEMETRY_DISABLED:'1',BACKUP_ENCRYPTION_KEY:'',PG_DUMP_PATH:'',PG_RESTORE_PATH:'',SANDBOX_RESTORE_URL:''}
  assert.equal(env.PAYMENTS_ENABLED,'false');assert.equal(env.ORDERS_ENABLED,'false');assert.equal(env.STRIPE_ENABLED,'false')
  state.closedEnvironment=env;saveTransitionState(state)
  const stage=mkdtempSync(join(process.cwd(),'.cache/closed-production-deploy-'))
  for(const dir of ['src','public','scripts','vendor']) cpSync(dir,join(stage,dir),{recursive:true})
  mkdirSync(join(stage,'prisma'))
  for(const file of ['schema.prisma','baseline.prisma']) cpSync(join('prisma',file),join(stage,'prisma',file))
  cpSync('prisma/migrations',join(stage,'prisma/migrations'),{recursive:true})
  for(const file of ['package.json','package-lock.json','.npmrc','tsconfig.json','tailwind.config.js','postcss.config.js','next.config.js','next-env.d.ts','.eslintrc.json']) if(existsSync(file))cpSync(file,join(stage,file))
  mkdirSync(join(stage,'.vercel'));writeFileSync(join(stage,'.vercel/project.json'),JSON.stringify(project))
  // Closed preparation only. Hobby cannot run the planned five-minute worker.
  // Preserve the reviewed source schedule; do not claim worker readiness or purchase an upgrade.
  writeFileSync(join(stage,'vercel.json'),JSON.stringify({crons:[]}))
  writeFileSync(join(stage,'.vercelignore'),'node_modules\n.next\n.git\n.env\n.env.*\n.cache\ndocs\nbackups\n*.enc\n*.recovery-key\n')
  const secrets=Object.entries(env).filter(([key,value])=>!key.startsWith('NEXT_PUBLIC_')&&/KEY|SECRET|TOKEN|PASS|URL/.test(key)&&value.length>=16).map(([,value])=>value)
  secrets.push(state.adminUrl,state.token,state.runtimePassword)
  let files=0
  function scan(dir:string){for(const name of readdirSync(dir)){const file=join(dir,name);if(statSync(file).isDirectory()){scan(file);continue}files++;assert(!/^\.env($|\.)/.test(name)&&!/\.(enc|dump|bak|recovery-key)$/.test(name));const value=readFileSync(file).toString('utf8');assert(!secrets.some(secret=>value.includes(secret)),'Secret appeared in upload stage')}}
  scan(stage)
  const cli=resolve(process.env.APPDATA!,'npm/node_modules/vercel/dist/index.js')
  const args=[cli,'deploy','--target','production','--skip-domain','--yes','--no-wait','--no-color']
  for(const name of Object.keys(env))args.push('--env',name,'--build-env',name)
  const report:any={checkedAt:new Date().toISOString(),target:'production',closed:true,realPaymentsEnabled:false,ordersEnabled:false,automaticDomainPromotion:false,originalProductionId:state.originalProductionId,submitted:false,url:null,stage,sourceFiles:files,originalCronPreserved:true,workerScheduled:false}
  // Private env exists only in protected checkpoint and child process. No secret arguments.
  let output='';const child=spawn(process.execPath,args,{cwd:stage,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']})
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk.toString()})
  const code=await new Promise<number|null>((ok,fail)=>{child.on('error',fail);child.on('close',ok)})
  for(const secret of secrets)output=output.replaceAll(secret,'[private]')
  writeFileSync('.cache/closed-production-deploy.log',output)
  report.url=(output.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/g)||[]).at(-1)||null
  report.submitted=code===0&&!!report.url;report.exitCode=code
  writeFileSync('docs/launch-closed-production-deployment-latest.json',JSON.stringify(report,null,2)+'\n')
  assert(report.submitted,'Closed production submission failed; inspect private sanitized log')
  console.log(JSON.stringify({submitted:true,url:report.url,closed:true,primaryDomainNotPromoted:true}))
}
main().catch(()=>{console.error('Closed deployment stopped; real payments remain disabled; private details withheld');process.exitCode=1})
