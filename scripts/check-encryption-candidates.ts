import { loadEnvConfig } from '@next/env'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { decryptTextWithKey, isEncryptedText, DELIVERY_SECRET_FIELDS } from '../src/lib/encryption'
async function main() {
  loadEnvConfig(process.cwd(),true,{info(){},error(){}})
  const files = ['.env','.env.local', ...process.argv.slice(2)]
  const candidates = files.filter(file=>existsSync(file)).flatMap(file => {
    const entries = readFileSync(file,'utf8').split(/\r?\n/).flatMap(line => {
      const match = line.match(/^\s*(?:export\s+)?(ENCRYPTION_KEY|OLD_ENCRYPTION_KEY)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))\s*(?:#.*)?$/)
      return match ? [{ source:file,variable:match[1],key:match[2] ?? match[3] ?? match[4] }] : []
    })
    return entries
  })
  const client = new Client({connectionString:process.env.DIRECT_URL,connectionTimeoutMillis:15000,statement_timeout:30000})
  try {
    await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const values: string[]=[]
    for (const [table,fields] of [['DigitalStock',['content']],['DigitalKey',['keyData']],['Order',['deliveredContent']],['DeliveryItem',[...DELIVERY_SECRET_FIELDS]]] as const) {
      const rows=(await client.query('SELECT '+fields.map(field=>'"'+field+'"').join(',')+' FROM public."'+table+'"')).rows
      for(const row of rows) for(const field of fields) if(isEncryptedText(row[field])) values.push(row[field])
    }
    const matched=new Set<number>()
    const result=candidates.map(candidate=>{
      let readable=0
      values.forEach((value,index)=>{try{decryptTextWithKey(value,candidate.key,{allowUnsafeDefault:true});readable++;matched.add(index)}catch{/*No private data printed*/}})
      return {source:candidate.source,variable:candidate.variable,readable,unreadable:values.length-readable}
    })
    await client.query('ROLLBACK')
    const report={checkedAt:new Date().toISOString(),readOnly:true,keysChanged:false,values:values.length,readableWithAvailableCandidates:matched.size,unreadable:values.length-matched.size,candidates:result}
    writeFileSync('docs/launch-key-candidates-latest.json',JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify(report,null,2))
  }finally{await client.end().catch(()=>{})}
}
main().catch(()=>{console.error('Candidate key check failed; private output withheld');process.exitCode=1})
