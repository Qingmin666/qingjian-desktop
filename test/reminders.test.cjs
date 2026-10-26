'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createReminderService}=require('../src/reminders.cjs'),M=require('../src/model.cjs');
test('启动补提醒并持久化去重，停止后不再发送',async()=>{let s=M.mutate(M.createState(),{type:'add',title:'过去的提醒',date:'2026-10-26',remindAt:'2026-10-26T01:00:00Z'}),sent=0,scheduled;
const service=createReminderService({getState:()=>s,now:()=>Date.parse('2026-10-26T02:00:00Z'),setTimer:(fn,ms)=>{scheduled={fn,ms};return 1;},clearTimer:()=>{},deliver:async t=>{sent++;s.tasks.find(x=>x.id===t.id).remindedAt='2026-10-26T02:00:00Z';}});
await service.start();assert.equal(sent,1);await service.check();assert.equal(sent,1);assert.ok(scheduled.ms<=30000);service.stop();s.tasks[0].remindedAt=null;await service.check();assert.equal(sent,1);});
test('调度失败可重试；提前唤醒不会发送未来提醒',async()=>{let clock=Date.parse('2026-10-26T00:00:00Z'),calls=0,errors=0;const s=M.mutate(M.createState(),{type:'add',title:'未来',date:'2026-10-26',remindAt:'2026-10-26T01:00:00Z'});
const service=createReminderService({getState:()=>s,now:()=>clock,setTimer:()=>1,clearTimer:()=>{},onError:()=>errors++,deliver:async t=>{calls++;if(calls===1)throw Error('模拟失败');t.remindedAt=new Date(clock).toISOString();}});
await service.start();assert.equal(calls,0);clock+=3600000;await service.check();assert.equal(errors,1);await service.check();assert.equal(calls,2);service.stop();});
