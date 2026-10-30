import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);}
for(const file of ['public','server','netlify/functions','scripts','test'].flatMap(walk).filter(f=>/\.(mjs|js)$/.test(f)))execFileSync(process.execPath,['--check',file]);
const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
for(const icon of [...manifest.icons,{src:'/icons/apple-touch-icon.png',sizes:'180x180'}]){
  const bytes=readFileSync('public'+icon.src),size=Number(icon.sizes.split('x')[0]);
  if(bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size)throw new Error('Wrong icon dimensions');
}
console.log('JavaScript syntax, manifest, and PNG dimensions passed.');
