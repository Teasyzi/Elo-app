import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files=['index.html','app.js','v36-11.js','app-fluidity.js','app-fluidity-core-v36-11-14.js','app-fluidity-hotfix-v36-11-16.js','app-fluidity-hotfix-v36-11-17.js','app-fluidity-hotfix-v36-11-18.js','app-fluidity-hotfix-v36-11-19.js','app-fluidity-hotfix-v36-11-20.js','app-fluidity-hotfix-v36-11-22.js','app-fluidity-hotfix-v36-11-27.js','styles.css','tailwind.css','manifest.json','404.html','android-version.json'];
await rm('www',{recursive:true,force:true});
await mkdir('www/icons',{recursive:true});
for(const file of files){if(existsSync(file))await cp(file,`www/${file}`)}
for(const icon of ['icon-192.png','icon-512.png']){if(existsSync(`icons/${icon}`))await cp(icon,`www/icons/${icon}`).catch(()=>cp(`icons/${icon}`,`www/icons/${icon}`))}

// O mesmo index.html é a fonte única para Web/PWA e APK.
console.log('Web assets preparados em ./www para o Capacitor (Android 0.9.1-rc1 · Elo V36.12 RC1).');