import test from 'node:test';
import assert from 'node:assert/strict';
import {rangeValues,eventRange} from '../../js/live/event-time.js';
test('date ranges preserve all-day calendar dates across DST and reject nonexistent local times',()=>{
 const previous=process.env.TZ;process.env.TZ='Europe/London';
 try{
 const value=rangeValues('2027-03-28','2027-03-28','12:00','13:00',true);
 assert.equal(+new Date(value.ends_at)-new Date(value.starts_at),23*3600000-1000);
 assert.match(eventRange(value),/All day/);
 assert.doesNotMatch(eventRange(value),/23:59/);
 assert.throws(()=>rangeValues('2027-03-28','2027-03-28','01:30','03:30',false),/clocks change/);
 assert.throws(()=>rangeValues('2027-03-28','2027-03-27','12:00','13:00',false),/end after/);
 const multi=rangeValues('2027-06-01','2027-06-03','12:00','13:00',false);
 assert.equal(+new Date(multi.ends_at)-new Date(multi.starts_at),49*3600000);
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
