import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files=['index.html','app.js','v36-11.js','styles.css','tailwind.css','manifest.json','404.html','android-version.json'];
await rm('www',{recursive:true,force:true});
await mkdir('www/icons',{recursive:true});
for(const file of files){if(existsSync(file))await cp(file,`www/${file}`)}
for(const icon of ['icon-192.png','icon-512.png']){if(existsSync(`icons/${icon}`))await cp(`icons/${icon}`,`www/icons/${icon}`)}

// V36.11 é carregada como módulo complementar no APK sem duplicar o app.js principal.
// A injeção ocorre apenas no www gerado, mantendo a fonte original previsível.
const indexPath='www/index.html';
if(existsSync(indexPath)&&existsSync('v36-11.js')){
  let html=await readFile(indexPath,'utf8');
  if(!html.includes('v36-11.js')){
    const tag='    <script type="module" src="./v36-11.js?v=36.11.0"></script>\n';
    html=html.includes('</body>')?html.replace('</body>',`${tag}</body>`):`${html}\n${tag}`;
    await writeFile(indexPath,html,'utf8');
  }
}
console.log('Web assets preparados em ./www para o Capacitor (V36.11 runtime incluído).');
