import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
// Use the installed CLI's OAuth refresh and scope handling. Never print raw JSON.
export async function vercelGet(path: string): Promise<any> {
  assert(/^\/v\d+\/(deployments|projects|aliases|teams)(\/|\?|$)/.test(path),'Unexpected read-only endpoint')
  const child=spawn(process.execPath,[resolve(process.env.APPDATA!,'npm/node_modules/vercel/dist/index.js'),'api',path,'-X','GET','--no-color'],{windowsHide:true,stdio:['ignore','pipe','pipe']})
  let output='';child.stdout.on('data',chunk=>{output+=chunk.toString()});child.stderr.on('data',()=>{})
  const code=await new Promise<number|null>((ok,fail)=>{child.on('error',fail);child.on('close',ok)})
  assert.equal(code,0,'Vercel CLI read-only request failed')
  return JSON.parse(output)
}
