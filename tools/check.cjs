'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
let count=0;for(const dir of ['src','tools','test'])for(const file of fs.readdirSync(path.join(__dirname,'..',dir)))if(/\.(cjs|js)$/.test(file)){const result=spawnSync(process.execPath,['--check',path.join(__dirname,'..',dir,file)],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr);process.exitCode=1;}count++;}console.log(count+' JavaScript files checked.');
