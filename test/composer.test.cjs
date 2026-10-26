"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),M=require('../src/model.cjs');
test('实际渲染器事件：＋直接输入、Enter保存、三个点才打开时间编辑',async()=>{
 const nodes=new Map();let document;
 class Node{
  constructor(){this.hidden=true;this.open=false;this.value='';this.dataset={};this.children=[];this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};}
  get childNodes(){return this.children;}
  setAttribute(k,v){this[k]=v;}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}addEventListener(){}focus(){document.activeElement=this;}blur(){document.activeElement=null;}showModal(){this.open=true;}close(){this.open=false;}querySelector(){return new Node();}getBoundingClientRect(){return {x:0,y:0,top:0,right:660,height:70};}
 }
 const get=s=>{if(!nodes.has(s))nodes.set(s,new Node());return nodes.get(s);};
 document={querySelector:get,querySelectorAll:()=>[],createElement:()=>new Node(),documentElement:new Node(),body:new Node(),activeElement:null,addEventListener(){}};
 let saved=M.createState(),revision=0;const snapshot=()=>({...saved,revision:++revision,selectedDate:'2026-10-26',displayMode:'all',frameRate:60,dataFile:'isolated/todos.json'});
 const todo={onState(){},onPreview(){},onCompose(){},onSettings(){},load:async()=>snapshot(),action:async a=>{saved=M.mutate(saved,a);return snapshot();},control:async()=>true,beginGesture(){},endGesture(){},previewSettings(){}};
 const context=vm.createContext({document,window:{QJTasks:M,todo,TodoFonts:{create:()=>({render(){},load(){}})}},QJAppearance:{apply(){}},QJGreetings:{start:()=>({refresh(){}})},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,requestAnimationFrame:fn=>fn(),innerWidth:660,innerHeight:500,confirm:()=>true});
 context.window.addEventListener=()=>{};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/renderer.js'),'utf8'),context);await new Promise(setImmediate);
 await get('#add-button').onclick();assert.equal(get('#quick-composer').hidden,false);assert.equal(get('#task-dialog').open,false);assert.equal(document.activeElement,get('#quick-title'));
 get('#quick-title').value='直接输入的新任务';await get('#quick-composer').onsubmit({preventDefault(){}});assert.equal(saved.tasks.length,1);assert.equal(saved.tasks[0].title,'直接输入的新任务');assert.equal(saved.tasks[0].dueAt,null);assert.equal(get('#quick-title').value,'',get('#toast-message').textContent);assert.equal(get('#task-dialog').open,false);
 const row=vm.runInContext('taskRow(state.tasks[0])',context);row.children[3].onclick({stopPropagation(){}});await new Promise(setImmediate);assert.equal(get('#task-dialog').open,true);assert.equal(get('#task-title').value,'直接输入的新任务');
});
