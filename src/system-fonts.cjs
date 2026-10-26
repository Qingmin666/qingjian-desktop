const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
let cached=null,pending=null;
function listSystemFonts(refresh=false){
  if(cached&&!refresh)return Promise.resolve(cached);
  if(pending)return pending;
  const packaged=path.join(process.resourcesPath,'native/FontCatalog.exe');
  const helper=fs.existsSync(packaged)?packaged:path.join(__dirname,'../artifacts/FontCatalog.exe');
  pending=new Promise((resolve,reject)=>execFile(helper,[],{windowsHide:true,encoding:'utf8',timeout:20000,maxBuffer:4*1024*1024},(error,stdout)=>{
    if(error){reject(new Error('无法读取本机字体，请点击刷新重试。'));return;}
    try{
      const fonts=JSON.parse(stdout.replace(/^\uFEFF/,''));
      if(!Array.isArray(fonts)||!fonts.length)throw Error('没有找到本机字体');
      cached=fonts.filter(font=>typeof font.family==='string'&&font.family.length<=256).map(font=>({family:font.family,aliases:Array.isArray(font.aliases)?font.aliases.filter(alias=>typeof alias==='string'):[]}));
      resolve(cached);
    }catch{reject(new Error('无法解析本机字体列表，请点击刷新重试。'));}
  })).finally(()=>{pending=null;});
  return pending;
}
module.exports={listSystemFonts};
