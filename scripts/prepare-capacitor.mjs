import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files=['index.html','app.js','v36-11.js','styles.css','tailwind.css','manifest.json','404.html','android-version.json'];
await rm('www',{recursive:true,force:true});
await mkdir('www/icons',{recursive:true});
for(const file of files){if(existsSync(file))await cp(file,`www/${file}`)}
for(const icon of ['icon-192.png','icon-512.png']){if(existsSync(`icons/${icon}`))await cp(`icons/${icon}`,`www/icons/${icon}`)}

// V36.11.4: index.html passa a ser a fonte única para Web/PWA e APK.
// Não injetamos mais scripts só no build Android; o mesmo HTML carrega app.js + v36-11.js em todas as plataformas.
console.log('Web assets preparados em ./www para o Capacitor (paridade Web/PWA/APK V36.11.4).');
