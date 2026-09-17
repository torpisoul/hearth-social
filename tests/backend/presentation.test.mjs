import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {relativeTime,calendarParts,sortConversations,conversationActivity} from '../../js/live/presentation.js';
import {enhanceChoices,choiceClick,choiceKey} from '../../js/live/soft-choices.js';
test('calendar badges respect all-day calendar zones and relative time handles boundaries',()=>{
 const event={starts_at:'2026-09-17T01:00:00Z',all_day:true,time_zone:'America/Los_Angeles'};
 assert.equal(calendarParts(event).day,'16');
 assert.equal(relativeTime('2026-09-17T01:00:00Z',Date.parse('2026-09-17T03:30:00Z')),'2h ago');
 assert.equal(relativeTime('invalid'),'');
 assert.equal(relativeTime('2099-01-01'),'Just now');
});
test('conversation ordering uses metadata for both directions and alphabetical ties',async()=>{
 const queries=[];
 const client={from(table){assert.equal(table,'hearth_messages');const q={select(columns){assert.equal(columns,'created_at');return q},or(filter){queries.push(filter);return q},order(){return q},limit(n){assert.equal(n,1);return Promise.resolve({data:[{created_at:'2026-09-17T01:00:00Z'}]})}};return q}};
 const result=await conversationActivity(client,'me',['a','b']);
 assert.ok(result.a===result.b&&result.a>0);
 assert.match(queries[0],/sender.eq.me,recipient.eq.a.*sender.eq.a,recipient.eq.me/);
 assert.deepEqual(sortConversations(['a','b','c'],{a:10,b:20},id=>id),['b','a','c']);
});
test('button choices preserve form values and restore keyboard focus',()=>{
 const dom=new JSDOM('<form id="test"><label class="field">Audience<select name="audience"><option>Only me</option><option>All kin</option></select></label></form>');
 globalThis.document=dom.window.document;
 enhanceChoices();document.addEventListener('click',choiceClick);document.addEventListener('keydown',choiceKey);
 const trigger=document.querySelector('[data-soft-toggle]');
 trigger.click();assert.equal(trigger.getAttribute('aria-expanded'),'true');
 assert.equal(document.activeElement.dataset.softOption,'Only me');
 document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
 assert.equal(document.activeElement.dataset.softOption,'All kin');document.activeElement.click();
 assert.equal(new dom.window.FormData(document.querySelector('form')).get('audience'),'All kin');
 assert.equal(document.activeElement,trigger);assert.equal(trigger.getAttribute('aria-expanded'),'false');
 trigger.click();document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(document.activeElement,trigger);assert.equal(document.querySelector('.soft-options').hidden,true);
 enhanceChoices();assert.equal(document.querySelectorAll('.soft-choice').length,1);
 dom.window.close();
});
