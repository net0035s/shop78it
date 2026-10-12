import {spawn} from 'node:child_process'
import {cloudSandboxEnvironment} from './cloud-sandbox-config'
async function main(){
 const env=cloudSandboxEnvironment()
 console.log('Shop78it sandbox: http://localhost:3000 — real payments and notifications disabled')
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','localhost','--port','3000'],{env,windowsHide:true,stdio:'inherit'})
 process.on('SIGINT',()=>child.kill('SIGTERM'));process.on('SIGTERM',()=>child.kill('SIGTERM'))
 process.exitCode=await new Promise<number>(resolve=>child.on('close',code=>resolve(code??1)))
}
main().catch(()=>{console.error('Sandbox startup stopped; check isolated configuration. Private details withheld.');process.exitCode=1})