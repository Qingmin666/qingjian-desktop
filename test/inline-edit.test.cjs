"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),M=require('../src/model.cjs');
async function mount(){
 const roots=new Map(),listeners=new Map();let document,saved=M.createState(),revision=0;
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.hidden=true;this.open=false;this.value='';this.dataset={};this.children=[];this.parentElement=null;this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};}
  get childNodes(){return this.children;}
  setAttribute(k,v){this[k]=v;}append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
  replaceChildren(...nodes){for(const n of this.children)n.parentElement=null;this.children=[];this.append(...nodes);}
  replaceWith(next){const parent=this.parentElement;if(parent){const i=parent.children.indexOf(this);parent.children[i]=next;next.parentElement=parent;this.parentElement=null;}}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}
  closest(selector){return selector.split(',').map(s=>s.trim()).some(s=>s.startsWith('#')?this.id===s.slice(1):s.startsWith('.')?(this.className||'').split(' ').includes(s.slice(1)):this.tagName===s.toUpperCase())?this:this.parentElement?.closest(selector)||null;}
  querySelector(selector){return walk(this).find(n=>n!==this&&n.closest(selector)===n)||null;}
  addEventListener(){}select(){this.selected=true;}focus(){const old=document.activeElement;document.activeElement=this;if(old&&old!==this)old.onblur?.();}
  blur(){if(document.activeElement===this){document.activeElement=null;this.onblur?.();}}showModal(){this.open=true;}close(){this.open=false;}
  getBoundingClientRect(){return{x:0,y:0,top:0,right:660,height:70};}
 }
 const walk=n=>[n,...n.children.flatMap(walk)];
 const get=s=>{if(!roots.has(s)){const n=new Element(s==='#task-dialog'?'dialog':s.includes('title')?'input':'div');n.id=s.slice(1);roots.set(s,n);}return roots.get(s);};
 document={querySelector:get,querySelectorAll:s=>[...new Set([...roots.values()].flatMap(walk))].filter(n=>n.closest(s)===n),createElement:t=>new Element(t),documentElement:new Element(),body:new Element(),activeElement:null,hidden:false,addEventListener(type,fn,capture=false){const list=listeners.get(type)||[];list.push({fn,capture});listeners.set(type,list);}};
 const snapshot=()=>({...saved,revision:++revision,selectedDate:'2026-10-26',displayMode:'all',frameRate:60,dataFile:'isolated/todos.json'});
 let onState;
 const todo={onState:f=>onState=f,onPreview(){},onCompose(){},onSettings(){},load:async()=>snapshot(),action:async a=>{saved=M.mutate(saved,a);return snapshot();},control:async()=>true,beginGesture(){},endGesture(){},previewSettings(){}};
 const context=vm.createContext({document,window:{QJTasks:M,todo,TodoFonts:{create:()=>({render(){},load(){}})},addEventListener(){}},QJAppearance:{apply(){}},QJGreetings:{start:()=>({refresh(){}})},setTimeout:(fn,ms)=>{if(ms===0)setImmediate(fn);return 0;},clearTimeout(){},setInterval:()=>0,requestAnimationFrame:fn=>fn(),innerWidth:660,innerHeight:500,confirm:()=>true});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),context);await new Promise(setImmediate);
 get('#quick-composer').append(get('#quick-title'),get('#quick-cancel'));
 const tick=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
 function dispatch(type,target,extra={}){const e={type,target,button:0,key:'',preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...extra};for(const l of listeners.get(type)||[])if(l.capture)l.fn(e);for(let n=target;n&&!e.stopped;n=n.parentElement)n['on'+type]?.(e);if(!e.stopped)for(const l of listeners.get(type)||[])if(!l.capture)l.fn(e);return e;}
 async function click(target){dispatch('pointerdown',target);if(document.activeElement!==target)document.activeElement?.blur();dispatch('pointerup',target);dispatch('click',target);await tick();}
 async function add(title,parentId=null){await vm.runInContext('action('+JSON.stringify({type:'add',title,date:'2026-10-26',parentId})+')',context);return saved.tasks.at(-1).id;}
 const row=id=>document.querySelectorAll('.task-row').find(n=>n.dataset.id===id);
 const input=()=>document.querySelectorAll('.inline-title-input')[0];
 return {get,document,context,dispatch,click,tick,add,row,input,state:()=>saved,refresh:()=>onState(snapshot()),key:(target,key,extra={})=>dispatch('keydown',target,{key,...extra})};
}
test('点击新增栏外部收起并保留草稿；栏内和＋点击不会收起',async()=>{const h=await mount();await h.click(h.get('#add-button'));h.get('#quick-title').value='未提交的草稿';await h.click(h.get('#quick-title'));assert.equal(h.get('#quick-composer').hidden,false);await h.click(h.get('#empty'));assert.equal(h.get('#quick-composer').hidden,true);assert.equal(h.state().tasks.length,0);await h.click(h.get('#add-button'));assert.equal(h.get('#quick-title').value,'未提交的草稿');h.key(h.get('#quick-title'),'Escape');assert.equal(h.get('#quick-composer').hidden,true);});
test('主任务与子任务标题原位编辑，Enter保存，Esc取消',async()=>{const h=await mount(),parent=await h.add('主任务'),child=await h.add('子任务',parent);for(const id of [parent,child]){await h.click(h.row(id).querySelector('.title-text'));let input=h.input();assert.ok(input);assert.equal(h.get('#task-dialog').open,false);input.value='修改后'+id;h.key(input,'Enter');await h.tick();assert.equal(h.state().tasks.find(t=>t.id===id).title,'修改后'+id);await h.click(h.row(id).querySelector('.title-text'));input=h.input();input.value='应该取消';h.key(input,'Escape');await h.tick();assert.equal(h.state().tasks.find(t=>t.id===id).title,'修改后'+id);assert.equal(h.input(),undefined);}});
test('点击空白失焦保存；空标题不覆盖原内容',async()=>{const h=await mount(),id=await h.add('原内容');await h.click(h.row(id).querySelector('.title-text'));h.input().value='自动保存';await h.click(h.get('#empty'));assert.equal(h.state().tasks[0].title,'自动保存');await h.click(h.row(id).querySelector('.title-text'));h.input().value='   ';await h.click(h.get('#empty'));assert.equal(h.state().tasks[0].title,'自动保存');assert.equal(h.input(),undefined);});
test('标题失焦同时点击勾选，保存与勾选都生效且不漏点击',async()=>{const h=await mount(),id=await h.add('原内容');await h.click(h.row(id).querySelector('.title-text'));h.input().value='修改同时完成';await h.click(h.row(id).children[1]);assert.equal(h.state().tasks[0].title,'修改同时完成');assert.equal(h.state().tasks[0].done,true);});
test('中文候选确认Enter不提交新增或标题，后台刷新保留编辑输入',async()=>{const h=await mount(),id=await h.add('中文标题');await h.click(h.row(id).querySelector('.title-text'));const input=h.input();input.value='中文输入中';h.key(input,'Enter',{isComposing:true,keyCode:229});await h.tick();assert.equal(h.state().tasks[0].title,'中文标题');h.refresh();assert.equal(h.input(),input);assert.equal(h.input().value,'中文输入中');h.key(input,'Enter');await h.tick();assert.equal(h.state().tasks[0].title,'中文输入中');await h.click(h.get('#add-button'));h.get('#quick-title').oncompositionstart();h.get('#quick-title').value='候选草稿';await h.get('#quick-composer').onsubmit({preventDefault(){}});assert.equal(h.state().tasks.length,1);h.get('#quick-title').oncompositionend();});
test('标题保存失败保留输入；随后修正可重试',async()=>{const h=await mount(),id=await h.add('有效标题');await h.click(h.row(id).querySelector('.title-text'));h.input().value='字'.repeat(501);h.key(h.input(),'Enter');await h.tick();assert.equal(h.state().tasks[0].title,'有效标题');assert.ok(h.input());assert.equal(h.input().disabled,false);h.input().value='修正标题';h.key(h.input(),'Enter');await h.tick();assert.equal(h.state().tasks[0].title,'修正标题');});
