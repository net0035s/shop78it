import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawn } from 'node:child_process'
import { previewIsIsolated } from '../src/lib/launch-readiness'

async function main() {
  assert.ok(process.argv.includes('--closed-sandbox'), 'Explicit closed sandbox required')
  const root = process.cwd()
  const project = JSON.parse(readFileSync('.cache/netlify-project.json','utf8'))
  assert.equal(project.name,'shop78it')
  assert.equal(project.accountSlug,'november-3-cr7mw')
  assert.equal(project.id,'1d1c3222-a3ce-4ad2-a38c-bae6a324f56c')
  const cli=resolve(process.env.LOCALAPPDATA!,'npm-cache/_npx/b3ca12a867cd0704/node_modules/netlify-cli/bin/run.js')
  assert.equal(JSON.parse(readFileSync(join(cli,'../../package.json'),'utf8')).version,'27.12.0')
  const env:Record<string,string>={}
  for(const line of readFileSync('.env.netlify.local','utf8').split(/\r?\n/)) {
    const match=line.match(/^([A-Z_]+)=(.*)$/);if(match)env[match[1]]=JSON.parse(match[2])
  }
  assert.ok(previewIsIsolated(env),'Isolated database required')
  for(const flag of ['ORDERS_ENABLED','PAYMENTS_ENABLED','LAUNCH_APPROVED','STRIPE_ENABLED','MAINTENANCE_ENABLED']) assert.equal(env[flag],'false')
  for(const key of ['EMAIL_PASS','TELEGRAM_BOT_TOKEN','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','TMN_RECEIVE_PHONE'])assert.equal(env[key],'')
  assert.ok(env.CLERK_SECRET_KEY.startsWith('sk_test_'))
  // The CLI resolves internal functions relative to its repository root. A
  // staging folder inside this checkout incorrectly uploads only user functions.
  const stage=mkdtempSync(join(tmpdir(),'shop78it-netlify-'))
  for(const dir of ['src','public','scripts','vendor'])cpSync(join(root,dir),join(stage,dir),{recursive:true})
  mkdirSync(join(stage,'prisma'),{recursive:true})
  for(const file of ['schema.prisma','baseline.prisma'])cpSync(join(root,'prisma',file),join(stage,'prisma',file))
  cpSync(join(root,'prisma/migrations'),join(stage,'prisma/migrations'),{recursive:true})
  cpSync(join(root,'netlify'),join(stage,'netlify'),{recursive:true})
  for(const file of ['package.json','package-lock.json','.npmrc','tsconfig.json','tailwind.config.js','postcss.config.js','next.config.js','next-env.d.ts','.eslintrc.json','netlify.toml'])if(existsSync(join(root,file)))cpSync(join(root,file),join(stage,file))
  mkdirSync(join(stage,'.netlify'))
  writeFileSync(join(stage,'.netlify/state.json'),JSON.stringify({siteId:project.id}))
  const secrets=Object.entries(env).filter(([k,v])=>/(SECRET|DATABASE_URL|DIRECT_URL|ENCRYPTION_KEY)/.test(k)&&v.length>=16).map(([,v])=>v)
  let files=0
  function scan(dir:string){for(const name of readdirSync(dir)){const file=join(dir,name);if(statSync(file).isDirectory()){scan(file);continue}files++;assert.ok(!/^\.env/.test(name));const content=readFileSync(file).toString('utf8');assert.ok(!secrets.some(v=>content.includes(v)),'Secret in source stage')}}
  scan(stage)
  const site=JSON.parse(execFileSync(process.execPath,[cli,'api','getSite','--data',JSON.stringify({site_id:project.id})],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
  assert.equal(site.name,'shop78it');assert.equal(site.account_slug,project.accountSlug)
  // No secret values in command arguments, logs, Git, or the source upload.
  execFileSync(process.execPath,[cli,'env:import',resolve('.env.netlify.local'),'--site',project.id],{cwd:stage,stdio:['ignore','pipe','pipe']})
  const report={checkedAt:new Date().toISOString(),siteId:project.id,url:project.url,stage,sourceFiles:files,environmentImported:true,realPaymentsEnabled:false,ordersEnabled:false,messagesEnabled:false,otherProjectsChanged:false,deployed:false}
  writeFileSync('.cache/netlify-deploy-stage.json',JSON.stringify(report,null,2))
  function redact(text:string){for(const secret of secrets)text=text.split(secret).join('[REDACTED]');return text}
  async function run(args:string[],cwd:string,childEnv:NodeJS.ProcessEnv){
    let output='';const child=spawn(process.execPath,args,{cwd,env:childEnv,windowsHide:true,stdio:['ignore','pipe','pipe']})
    child.stdout.on('data',(b:Buffer)=>output+=b.toString());child.stderr.on('data',(b:Buffer)=>output+=b.toString())
    const code=await new Promise<number|null>((done,reject)=>{child.on('error',reject);child.on('exit',done)})
    writeFileSync('.cache/netlify-build.log',redact(output))
    if(code!==0)throw new Error('Netlify preparation failed; inspect sanitized .cache/netlify-build.log')
  }
  console.log(JSON.stringify({site:project.name,sourceFiles:files,environmentImported:true,sourceSecretsExcluded:true,phase:'installing stage dependencies'}))
  const childEnv={...process.env,NEXT_TELEMETRY_DISABLED:'1',CLERK_TELEMETRY_DISABLED:'1'}
  const npmCli=process.env.npm_execpath || join(process.env.ProgramFiles!,'nodejs/node_modules/npm/bin/npm-cli.js')
  assert.ok(existsSync(npmCli),'Installed npm entry point not found')
  await run([npmCli,'ci','--no-audit','--no-fund'],stage,childEnv)
  assert.ok(existsSync(join(stage,'node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node')),'Linux Lambda Prisma engine missing')
  console.log('Stage dependencies installed; building and deploying closed sandbox')
  await run([cli,'deploy','--site',project.id,'--context','production','--prod','--json'],stage,{...childEnv,NETLIFY:'true',CONTEXT:'production',URL:project.url})
  const result=JSON.parse(execFileSync(process.execPath,[cli,'api','getSite','--data',JSON.stringify({site_id:project.id})],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
  assert.equal(result.published_deploy?.state,'ready')
  const deploy=JSON.parse(execFileSync(process.execPath,[cli,'api','getDeploy','--data',JSON.stringify({deploy_id:result.published_deploy.id})],{encoding:'utf8',stdio:['ignore','pipe','pipe']}))
  assert.ok(deploy.available_functions?.some((fn:{n:string})=>fn.n==='___netlify-server-handler'),'Next.js server handler was not uploaded')
  const metadata=JSON.parse(readFileSync(join(stage,'.next/required-server-files.json'),'utf8')).config.env
  assert.equal(metadata.SHOP_HOSTING_PROVIDER,'netlify');assert.equal(metadata.SHOP_DEPLOYMENT_ENV,'preview');assert.equal(metadata.SHOP_DEPLOYMENT_URL,project.url)
  Object.assign(report,{deployed:true,deploymentId:result.published_deploy.id,finishedAt:new Date().toISOString()})
  writeFileSync('docs/netlify-deployment-latest.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify({deployed:true,siteId:project.id,url:project.url,deploymentId:result.published_deploy.id,closedSandbox:true}))
}
main().catch(()=>{console.error('Netlify deployment stopped safely; credentials were not printed.');process.exitCode=1})
