import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { readFileSync, readdirSync } from 'node:fs'
export async function sandboxDatabase() {
 if (process.env.SANDBOX_POSTGRES_URL) {
  const {postgresSandbox}=await import('./postgres-sandbox')
  return postgresSandbox(process.env.SANDBOX_POSTGRES_URL)
 }
 const db = new PGlite()
 await db.waitReady
 for(const name of readdirSync('prisma/migrations').filter(n=>/^[0-9]/.test(n)).sort()) await db.exec(readFileSync('prisma/migrations/'+name+'/migration.sql','utf8'))
 const server=new PGLiteSocketServer({db,port:0,host:'127.0.0.1',maxConnections:4})
 await server.start()
 const conn=server.getServerConn()
 return {url:'postgresql://postgres:postgres@'+conn+'/postgres?connection_limit=1&pgbouncer=true&statement_cache_size=0',close:async()=>{await server.stop();await db.close()}}
}
