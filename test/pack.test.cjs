'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
test('ASAR 打包保留内容、偏移和完整性摘要，排除 data 与字体',()=>{
 const tempBase=path.resolve(__dirname,'../test-results');fs.mkdirSync(tempBase,{recursive:true});const root=fs.mkdtempSync(path.join(tempBase,'qingjian-pack-test-'));
 try{
  const src=path.join(root,'src');fs.mkdirSync(src);fs.mkdirSync(path.join(src,'data'));fs.mkdirSync(path.join(src,'fonts'));fs.writeFileSync(path.join(src,'data','private.json'),'PRIVATE');fs.writeFileSync(path.join(src,'fonts','old.ttf'),'FONT');fs.writeFileSync(path.join(src,'main.cjs'),'中文与 UTF-8');
  const output=path.join(root,'app.asar'),result=spawnSync(process.execPath,[path.resolve(__dirname,'../tools/pack.cjs'),src,output],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const buf=fs.readFileSync(output);assert.equal(buf.readUInt32LE(0),4);const hlen=buf.readUInt32LE(4),jsonlen=buf.readUInt32LE(12),header=JSON.parse(buf.subarray(16,16+jsonlen).toString('utf8'));
  assert.equal(header.files.data,undefined);assert.equal(header.files.fonts,undefined);const e=header.files['main.cjs'],start=8+hlen+Number(e.offset),payload=buf.subarray(start,start+e.size);
  assert.equal(payload.toString('utf8'),'中文与 UTF-8');assert.equal(crypto.createHash('sha256').update(payload).digest('hex'),e.integrity.hash);
 }finally{assert.equal(path.dirname(root),tempBase);assert.ok(path.basename(root).startsWith('qingjian-pack-test-'));fs.rmSync(root,{recursive:true,force:true});}
});
