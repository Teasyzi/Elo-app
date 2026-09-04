import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const files=[
  'index.html','app.js','v36-11.js','app-fluidity.js','android-rc2-guard.js','android-distribution-v36-12.js',
  'app-fluidity-core-v36-11-14.js','app-fluidity-hotfix-v36-11-16.js','app-fluidity-hotfix-v36-11-17.js',
  'app-fluidity-hotfix-v36-11-18.js','app-fluidity-hotfix-v36-11-19.js','app-fluidity-hotfix-v36-11-20.js',
  'app-fluidity-hotfix-v36-11-22.js','app-fluidity-hotfix-v36-11-27.js',
  'app-fluidity-hotfix-v36-12-theme-exit.js','app-fluidity-hotfix-v36-12-session-restore.js',
  'app-fluidity-hotfix-v36-12-login-stability.js',
  'styles.css','tailwind.css','manifest.json','404.html','android-version.json'
];

const gradle = await readFile('android/app/build.gradle','utf8');
const versionCode = Number(gradle.match(/\bversionCode\s+(\d+)/)?.[1] || 0);
const versionName = gradle.match(/\bversionName\s+["']([^"']+)["']/)?.[1] || '';
if (!versionCode || !versionName) throw new Error('Não foi possível ler versionCode/versionName de android/app/build.gradle');

for (const file of files) {
  if (!existsSync(file)) throw new Error(`Asset obrigatório ausente para o APK: ${file}`);
}

await rm('www',{recursive:true,force:true});
await mkdir('www/icons',{recursive:true});
for(const file of files) await cp(file,`www/${file}`);
for(const icon of ['icon-192.png','icon-512.png']){
  if(!existsSync(`icons/${icon}`)) throw new Error(`Ícone obrigatório ausente para o APK: icons/${icon}`);
  await cp(`icons/${icon}`,`www/icons/${icon}`);
}

// app-fluidity.js é um ES module: se qualquer import local faltar no pacote, todo o módulo falha
// antes de executar. Validamos os imports aqui para evitar APKs sem os hotfixes/temas atuais.
const fluiditySource = await readFile('app-fluidity.js','utf8');
const localImports = [...fluiditySource.matchAll(/import\s+['"]\.\/(.+?)['"]/g)].map(match=>match[1]);
for (const importedFile of localImports) {
  if (!existsSync(`www/${importedFile}`)) {
    throw new Error(`Import local de app-fluidity.js não foi empacotado no APK: ${importedFile}`);
  }
}

// O comparador de atualização precisa conhecer a versão REAL empacotada no APK.
// Isso evita que uma build nova se identifique como uma RC antiga e ofereça a si própria como update.
const distributionPath = 'www/android-distribution-v36-12.js';
let distribution = await readFile(distributionPath,'utf8');
const releasePattern = /const ANDROID_RELEASE = \{ versionName: '[^']+', versionCode: \d+ \};/;
if (!releasePattern.test(distribution)) throw new Error('ANDROID_RELEASE não encontrado em android-distribution-v36-12.js');
distribution = distribution.replace(
  releasePattern,
  `const ANDROID_RELEASE = { versionName: '${versionName}', versionCode: ${versionCode} };`
);
await writeFile(distributionPath,distribution,'utf8');

console.log(`Web assets preparados em ./www para o Capacitor (Android ${versionName} · Elo V36.12 · migração PWA→APK ativa).`);
console.log(`Validação concluída: ${localImports.length} imports locais de app-fluidity.js presentes no APK.`);
