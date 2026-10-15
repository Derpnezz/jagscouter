const fs = require('node:fs');
const path = require('node:path');
const destination = path.join(__dirname,'dist/public');
fs.mkdirSync(destination,{recursive:true});
for (const entry of ['index.html','sw.js','css','js','config','manifest.webmanifest','icon.svg']) {
  fs.cpSync(path.join(__dirname,entry),path.join(destination,entry),{recursive:true});
}
console.log('Static website built in dist/public');