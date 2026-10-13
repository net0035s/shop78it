import assert from 'node:assert/strict'

/** Checking only HTML misses broken client navigation when Next.js chunks 404. */
export async function verifyNetlifyAssets(base: string) {
  const pages=['/','/checkout','/thank-you','/track']
  const assets=new Set<string>()
  for(const path of pages) {
    const response=await fetch(base+path,{signal:AbortSignal.timeout(45000)})
    assert.equal(response.status,200,path+' HTML')
    const html=await response.text()
    const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match=>match[1]).filter(path=>path.startsWith('/_next/'))
    assert.ok(scripts.length>0,path+' must reference client scripts')
    for(const script of scripts)assets.add(script)
    for(const match of html.matchAll(/<link[^>]*href="([^"]+\.css(?:\?[^"]*)?)"/g))if(match[1].startsWith('/_next/'))assets.add(match[1])
  }
  const results=await Promise.all([...assets].map(async path=>{
    const response=await fetch(base+path,{signal:AbortSignal.timeout(45000)})
    assert.equal(response.status,200,path+' asset')
    assert.ok(/javascript|text\/css/.test(response.headers.get('content-type')||''),path+' content type')
    return path
  }))
  return {pagesChecked:pages.length,assetsChecked:results.length,allAssetsReachable:true}
}
