import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cloudSandboxEnvironment } from './cloud-sandbox-config'
import { DEFAULT_UNSAFE_ENCRYPTION_KEYS } from '../src/lib/encryption'

// Local only. Writes an ignored import file, never prints credentials.
const env = cloudSandboxEnvironment()
const keys = ['DATABASE_URL','DIRECT_URL','ENCRYPTION_KEY','SANDBOX_DATABASE_FINGERPRINT','PRODUCTION_DATABASE_FINGERPRINT','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY','CLERK_SECRET_KEY','ADMIN_EMAILS']
const selected: Record<string,string> = Object.fromEntries(keys.map(k=>[k,env[k] || '']))
Object.assign(selected, {APP_MODE:'sandbox',ORDERS_ENABLED:'false',PAYMENTS_ENABLED:'false',LAUNCH_APPROVED:'false',STRIPE_ENABLED:'false',MAINTENANCE_ENABLED:'false',NEXT_PUBLIC_SITE_URL:'https://shop78it.netlify.app',CRON_SECRET:randomBytes(32).toString('hex'),EMAIL_USER:'',EMAIL_PASS:'',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:'',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',TMN_RECEIVE_PHONE:'',PROMPTPAY_NUMBER:'',SLIPOK_API_KEY:'',SLIPOK_BRANCH_ID:'',SLIP_VERIFY_API_KEY:'',SLIP_VERIFY_API_URL:'',NEXT_PUBLIC_GA_ID:'',NEXT_PUBLIC_FB_PIXEL_ID:''})
writeFileSync('.env.netlify.local', Object.entries(selected).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n')
execFileSync('git',['check-ignore','.env.netlify.local'],{stdio:'pipe'})

const privateValues: string[] = []
for (const file of ['.env','.env.local','.env.sandbox.local','.env.netlify.local']) {
  if (!existsSync(file)) continue
  for (const line of readFileSync(file,'utf8').split(/\r?\n/)) {
    const match=line.match(/^\s*([\w]+)\s*=\s*(.*?)\s*$/)
    if (!match || !/(?:SECRET|PASSWORD|PASS$|TOKEN|ENCRYPTION_KEY|DATABASE_URL|DIRECT_URL|API_KEY)/.test(match[1])) continue
    let value=match[2]
    if ((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1)
    if (value.length>=16 && !DEFAULT_UNSAFE_ENCRYPTION_KEYS.has(value)) privateValues.push(value)
  }
}
const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)
const failed: string[]=[]
for (const name of names) {
  if (!existsSync(name)) continue
  const bytes=readFileSync(name),text=bytes.toString('utf8')
  if ((/^\.env/.test(name)&&name!=='.env.example') || /\.(enc|recovery-key|dump|bak)$/.test(name) ||
      privateValues.some(v=>text.includes(v)) || /(?:[rs]k_(?:live|test)_[A-Za-z0-9]{30,}|whsec_[A-Za-z0-9]{25,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text)) failed.push(name)
}
if(failed.length) throw new Error('Private contents found in candidate files: '+failed.join(', '))
console.log(JSON.stringify({sourceFilesScanned:names.length,secretScan:'passed',ignoredEnvironmentFile:'.env.netlify.local',database:'isolated sandbox',ordersEnabled:false,realPaymentsEnabled:false,messagesEnabled:false}))
