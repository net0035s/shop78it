const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const catalog = JSON.parse(fs.readFileSync('docs/windows-office-catalog.json', 'utf8'))
const output = path.resolve('public/images/products/software')
fs.mkdirSync(output, { recursive: true })
const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

async function main() {
  for (const product of catalog.products) {
    const windows = product.category === 'windows'
    const account = product.stockType === 'login-info'
    const year = windows ? (product.name.includes('10') ? '10' : '11') : account ? '365' : product.name.match(/20\d\d/)[0]
    const edition = windows ? (product.name.endsWith('Home') ? 'HOME' : 'PRO') : account ? '1 YEAR · ACCOUNT' : year === '2024' ? 'LTSC · PRO PLUS' : 'PRO PLUS'
    const accent = windows ? (edition === 'HOME' ? '#38BDF8' : '#818CF8') : account ? '#A78BFA' : ({ '2016': '#FB923C', '2019': '#F97316', '2021': '#F87171', '2024': '#FB7185' })[year]
    const icon = windows
      ? '<g fill="url(#mark)"><rect x="1060" y="230" width="165" height="165" rx="8"/><rect x="1240" y="230" width="165" height="165" rx="8"/><rect x="1060" y="410" width="165" height="165" rx="8"/><rect x="1240" y="410" width="165" height="165" rx="8"/></g>'
      : '<g><rect x="1050" y="180" width="350" height="440" rx="48" fill="url(#mark)"/><rect x="1090" y="220" width="270" height="360" rx="28" fill="#121322" opacity=".92"/><text x="1225" y="465" text-anchor="middle" font-size="220" font-weight="700" fill="white">O</text><path d="M1130 520h190" stroke="'+accent+'" stroke-width="12" stroke-linecap="round"/></g>'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="${escape(product.name)}">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#171B32"/><stop offset="1" stop-color="#090B16"/></linearGradient><radialGradient id="glow"><stop stop-color="${accent}" stop-opacity=".22"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient><linearGradient id="mark" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".45"/></linearGradient><pattern id="grid" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M70 0H0V70" fill="none" stroke="#FFFFFF" stroke-opacity=".035"/></pattern></defs>
<rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#grid)"/><ellipse cx="1230" cy="400" rx="620" ry="610" fill="url(#glow)"/>
<g font-family="Segoe UI, Arial, sans-serif"><text x="96" y="126" fill="#A1A8C4" font-size="34" font-weight="600" letter-spacing="7">${windows ? 'OPERATING SYSTEM' : account ? 'OFFICE SUBSCRIPTION' : 'PRODUCTIVITY SOFTWARE'}</text>
<text x="88" y="270" fill="#FFFFFF" font-size="116" font-weight="650" letter-spacing="-4">${windows ? 'Windows' : 'Office'}</text>
<text x="86" y="482" fill="${accent}" font-size="${windows ? '225' : '188'}" font-weight="750" letter-spacing="-8">${year}</text>
<rect x="94" y="556" width="${edition.length > 12 ? '535' : account ? '580' : '365'}" height="87" rx="20" fill="${accent}" fill-opacity=".12" stroke="${accent}" stroke-opacity=".5"/><text x="128" y="615" fill="#FFFFFF" font-size="45" font-weight="650" letter-spacing="3">${edition}</text>
${icon}
<path d="M96 725H1504" stroke="#FFFFFF" stroke-opacity=".12"/><text x="96" y="802" fill="#BCC3D9" font-size="30" font-weight="500" letter-spacing="3">${account ? 'EMAIL + PASSWORD' : 'LICENSE KEY · 1 PC'}</text><text x="1504" y="802" text-anchor="end" fill="#D8DBEB" font-size="34" font-weight="700">Shop78it</text></g></svg>`
    fs.writeFileSync(path.join(output, product.id + '.svg'), svg)
    await sharp(Buffer.from(svg)).webp({ quality: 92 }).toFile(path.join(output, product.id + '.webp'))
    product.image = '/images/products/software/' + product.id + '.webp'
  }
  fs.writeFileSync('docs/windows-office-catalog.json', JSON.stringify(catalog, null, 2))
  const tiles = await Promise.all(catalog.products.map(p => sharp(path.join(output,p.id+'.webp')).resize(480,270).png().toBuffer()))
  await sharp({create:{width:1440,height:810,channels:4,background:'#090B16'}}).composite(tiles.map((input,i)=>({input,left:i%3*480,top:Math.floor(i/3)*270}))).png().toFile('.cache/software-covers-preview.png')
  console.log(JSON.stringify({covers:catalog.products.length,width:1600,height:900,format:'webp'}))
}
main().catch(()=>{console.error('Software cover generation failed');process.exitCode=1})
