"use strict";
const M=require('./model.cjs'),{createHash}=require('node:crypto');
const string=(max=128)=>({type:'string',minLength:1,maxLength:max}),bool={type:'boolean'},time={type:['string','null'],maxLength:40,description:'ISO 8601 timestamp with explicit Z or UTC offset; null clears it.'};
const mutation={requestId:{...string(),description:'Unique UUID for this mutation; reuse the identical request on retry.'},expectedRevision:{...string(),description:'Revision returned by info/list/get; stale revisions are rejected.'}};
function tool(name,description,props={},required=[],write=false,destructive=false){return{name,title:name,description,inputSchema:{type:'object',properties:write?{...props,...mutation}:props,required:write?[...required,'requestId','expectedRevision']:required,additionalProperties:false},annotations:{readOnlyHint:!write,destructiveHint:destructive,idempotentHint:true,openWorldHint:false}};}
const tools=[
 tool('qingjian_info','Get local date, time zone, ordering and current revision.'),
 tool('qingjian_list_tasks','List tasks with optional filters and offset pagination.',{date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},done:bool,parentId:{type:['string','null'],maxLength:128},query:{type:'string',maxLength:500},limit:{type:'integer',minimum:1,maximum:200},offset:{type:'integer',minimum:0,maximum:50000}}),
 tool('qingjian_get_task','Read one task and its children.',{id:string()},['id']),
 tool('qingjian_add_task','Create a root task or one-level child; missing date defaults to the local date.',{title:string(500),date:{type:'string',maxLength:10},parentId:{type:['string','null'],maxLength:128},dueAt:time,remindAt:time},['title'],true),
 tool('qingjian_update_task','Update title/date/deadline/reminder. A child follows its parent date.',{id:string(),title:string(500),date:{type:'string',maxLength:10},dueAt:time,remindAt:time},['id'],true),
 tool('qingjian_set_completed','Explicitly complete or reopen a task; applies the existing parent/child rules.',{id:string(),done:bool},['id','done'],true),
 tool('qingjian_set_pinned','Pin or unpin a root task.',{id:string(),pinned:bool},['id','pinned'],true),
 tool('qingjian_move_task','Move into/out of a parent or position within a manual ordering group. One child level only.',{id:string(),parentId:{type:['string','null'],maxLength:128},date:{type:'string',maxLength:10},pinned:bool,beforeId:string(),afterId:string()},['id','parentId'],true),
 tool('qingjian_reorder_tasks','Set the complete order of one manual group; obtain all IDs before calling.',{ids:{type:'array',items:string(),minItems:1,maxItems:2000,uniqueItems:true},parentId:{type:['string','null'],maxLength:128},date:{type:'string',maxLength:10},pinned:bool},['ids'],true),
 tool('qingjian_delete_task','Delete a task and all its children. Ask the user for confirmation in the client/Skill before calling. The server does not add a second dialog.',{id:string()},['id'],true,true)
];
function canonical(v){if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const revision=s=>hash({tasks:s.tasks,sortMode:s.settings.sortMode,autoCompleteParent:s.settings.autoCompleteParent}).slice(0,24);
function validate(schema,value,label='arguments'){
 const types=Array.isArray(schema.type)?schema.type:[schema.type],type=value===null?'null':Array.isArray(value)?'array':typeof value;
 if(!types.includes(type)&&!(types.includes('integer')&&Number.isSafeInteger(value)))throw Error(label+': invalid type');
 if(type==='string'){if(schema.minLength&&value.length<schema.minLength||schema.maxLength&&value.length>schema.maxLength)throw Error(label+': invalid length');if(schema.pattern&&!new RegExp(schema.pattern).test(value))throw Error(label+': invalid format');}
 if(type==='number'&&(schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum))throw Error(label+': out of range');
 if(type==='array'){if(schema.minItems&&value.length<schema.minItems||schema.maxItems&&value.length>schema.maxItems)throw Error(label+': invalid count');if(schema.uniqueItems&&new Set(value.map(canonical)).size!==value.length)throw Error(label+': duplicate values');value.forEach((v,i)=>validate(schema.items,v,label+'['+i+']'));}
 if(type==='object'){for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw Error(label+': missing '+key);for(const [key,v] of Object.entries(value)){if(!Object.hasOwn(schema.properties||{},key))throw Error(label+': unknown '+key);validate(schema.properties[key],v,label+'.'+key);}}
}
function createTaskTools({getState,commit}){
 function call(name,args={}){
  const definition=tools.find(t=>t.name===name);if(!definition)throw Object.assign(Error('Unknown tool'),{rpcCode:-32602});
  try{validate(definition.inputSchema,args);}catch(e){return failure('INVALID_ARGUMENT',e.message);}
  const s=getState(),rev=revision(s),read=!Object.hasOwn(definition.inputSchema.properties,'requestId');
  try{
   if(name==='qingjian_info')return success({revision:rev,localDate:M.dateKey(),now:new Date().toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,sortMode:s.settings.sortMode,taskCount:s.tasks.length,childDepth:1});
   if(name==='qingjian_list_tasks'){if(args.date&&!M.validDate(args.date))throw Error('无效日期');const filtered=s.tasks.filter(t=>(!args.date||t.date===args.date)&&(!Object.hasOwn(args,'done')||t.done===args.done)&&(!Object.hasOwn(args,'parentId')||(t.parentId||null)===args.parentId)&&(!args.query||t.title.toLocaleLowerCase().includes(args.query.toLocaleLowerCase())));const offset=args.offset||0,limit=args.limit||100;return success({revision:rev,tasks:M.sort(filtered,s.settings.sortMode).slice(offset,offset+limit),total:filtered.length,nextOffset:offset+limit<filtered.length?offset+limit:null});}
   const task=s.tasks.find(t=>t.id===args.id);
   if(name==='qingjian_get_task'){if(!task)return failure('NOT_FOUND','任务不存在');return success({revision:rev,task,children:M.children(s,task.id)});}
   if(read)throw Error('Unsupported read tool');
   const digest=hash({name,args}),receipts=Array.isArray(s.mcpReceipts)?s.mcpReceipts:[],existing=receipts.find(r=>r.requestId===args.requestId);
   if(existing){if(existing.digest!==digest)return failure('REQUEST_ID_REUSED','请求编号已用于其他操作');return success({...existing.result,replayed:true,currentRevision:rev});}
   if(args.expectedRevision!==rev)return failure('CONFLICT','任务已被其他客户端或界面修改，请重新读取后再操作',{currentRevision:rev});
   let next=s,affectedIds=[],created=null;
   const clean={...args};delete clean.requestId;delete clean.expectedRevision;
   if(name==='qingjian_add_task'){next=M.mutate(s,{...clean,type:'add',date:args.date||M.dateKey()});const oldIds=new Set(s.tasks.map(t=>t.id));created=next.tasks.find(t=>!oldIds.has(t.id));affectedIds=[created.id];}
   else{
    if(name!=='qingjian_reorder_tasks'&&!task)return failure('NOT_FOUND','任务不存在');
    if(name==='qingjian_update_task'){if(!['title','date','dueAt','remindAt'].some(k=>Object.hasOwn(args,k)))throw Error('没有指定修改字段');next=M.mutate(s,{...clean,type:'edit'});}
    else if(name==='qingjian_set_completed'){if(task.done!==args.done)next=M.mutate(s,{type:'toggle',id:task.id});}
    else if(name==='qingjian_set_pinned'){if(task.parentId)throw Error('只能置顶主任务');if(task.pinned!==args.pinned)next=M.mutate(s,{type:'pin',id:task.id});}
    else if(name==='qingjian_move_task')next=M.mutate(s,{...clean,type:'move'});
    else if(name==='qingjian_reorder_tasks')next=M.mutate(s,{...clean,type:'reorder'});
    else if(name==='qingjian_delete_task')next=M.mutate(s,{type:'delete',id:task.id});
    else throw Error('Unsupported operation');
    const nextById=new Map(next.tasks.map(t=>[t.id,t]));affectedIds=s.tasks.filter(t=>!nextById.has(t.id)||canonical(t)!==canonical(nextById.get(t.id))).map(t=>t.id);
   }
   const result={revision:revision(next),affectedIds,...(created?{task:created}:name==='qingjian_delete_task'?{deletedIds:affectedIds}:args.id?{task:next.tasks.find(t=>t.id===args.id)}:{})};
   const receipt={requestId:args.requestId,digest,result};next={...next,mcpReceipts:[...receipts,receipt].slice(-128)};
   commit(next);return success(result);
  }catch(e){return failure('OPERATION_FAILED',e.message);}
 }
 return {list:()=>structuredClone(tools),call};
}
function success(data){return{content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false};}
function failure(code,message,extra={}){return{content:[{type:'text',text:message}],structuredContent:{error:{code,message,...extra}},isError:true};}
module.exports={createTaskTools,revision,tools,validate};
