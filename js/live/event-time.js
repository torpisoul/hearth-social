const pad=n=>String(n).padStart(2,"0");
export const localStamp=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export function eventRange(event) {
 if(!event.starts_at)return "Choose dates and times";
 const start=new Date(event.starts_at),end=new Date(event.ends_at || event.starts_at);
 if(event.all_day){
  const fmt=new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeZone:event.time_zone || "UTC"});
  const first=fmt.format(start),last=fmt.format(end);
  return `${first}${first===last?"":" – "+last} · All day`;
 }
 const fmt=new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"});
 return fmt.format(start)+(end>start?" – "+fmt.format(end):"");
}
export function rangeValues(startDate,endDate,startTime,endTime,allDay) {
 const from=`${startDate}T${allDay?"00:00:00":startTime+":00"}`;
 const to=`${endDate}T${allDay?"23:59:59":endTime+":00"}`;
 const start=new Date(from),end=new Date(to);
 if(!Number.isFinite(+start)||!Number.isFinite(+end)||localStamp(start)!==from.slice(0,16)||localStamp(end)!==to.slice(0,16))throw Error("Choose valid dates and times. That time may not exist when the clocks change.");
 if(end<=start)throw Error("Choose an end after the start.");
 if(end<=new Date())throw Error("Choose an end in the future.");
 return {starts_at:start.toISOString(),ends_at:end.toISOString(),all_day:allDay,time_zone:Intl.DateTimeFormat().resolvedOptions().timeZone};
}
export function openEventTime(value,onConfirm) {
 const opener=document.activeElement;
 const fallback=new Date(Date.now()+3600000);fallback.setMinutes(0,0,0);
 let start=new Date(value.starts_at || fallback),end=new Date(value.ends_at || +start+3600000);
 if(end<=start)end=new Date(+start+3600000);
 let startDate=localStamp(start).slice(0,10),endDate=localStamp(end).slice(0,10);
 let allDay=Boolean(value.all_day),startTime=localStamp(start).slice(11),endTime=localStamp(end).slice(11),target="start";
 // All-day dates remain calendar dates when opened from another time zone.
 if(allDay && value.time_zone){
  const parts=d=>Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:value.time_zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d).map(p=>[p.type,p.value]));
  const a=parts(start),b=parts(end);startDate=`${a.year}-${a.month}-${a.day}`;endDate=`${b.year}-${b.month}-${b.day}`;
 }
 let month=startDate.slice(0,7);
 const dialog=document.createElement("dialog");dialog.className="soft-dialog event-time-dialog";dialog.setAttribute("aria-labelledby","event-time-title");
 function draw(){
  const [year,m]=month.split("-").map(Number),days=new Date(year,m,0).getDate(),offset=(new Date(year,m-1,1).getDay()+6)%7;
  const monthLabel=new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(new Date(year,m-1,1));
  dialog.innerHTML=`<h2 id="event-time-title">When shall we get together?</h2><form id="event-time-form">
  <label class="remember-choice"><input type="checkbox" name="all_day" ${allDay?"checked":""}><span>All day</span></label>
  <div class="live-pair date-targets"><button type="button" data-target="start" aria-pressed="${target==="start"}">Start · ${startDate}</button><button type="button" data-target="end" aria-pressed="${target==="end"}">End · ${endDate}</button></div>
  <div class="calendar-heading"><button type="button" data-month="-1" aria-label="Previous month">‹</button><strong aria-live="polite">${monthLabel}</strong><button type="button" data-month="1" aria-label="Next month">›</button></div>
  <div class="calendar-days"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>${'<span></span>'.repeat(offset)}${Array.from({length:days},(_,i)=>{const date=month+"-"+pad(i+1);return `<button type="button" data-day="${date}" aria-label="${date}" aria-pressed="${date===(target==="start"?startDate:endDate)}">${i+1}</button>`}).join("")}</div>
  <div class="live-pair date-times" ${allDay?"hidden":""}><label class="field">Start time<input type="time" name="start_time" value="${startTime}" ${allDay?"":"required"}></label><label class="field">End time<input type="time" name="end_time" value="${endTime}" ${allDay?"":"required"}></label></div>
  <p class="live-muted">Dates and times use this device’s time zone.</p><p id="event-time-error" role="alert"></p>
  <div class="live-actions"><button type="button" data-cancel>Cancel</button><button type="submit" class="primary">Confirm dates</button></div></form>`;
 }
 dialog.addEventListener("click",e=>{
  e.stopPropagation();const b=e.target.closest("button");if(!b)return;
  if(b.hasAttribute("data-cancel")){dialog.close();return;}
  if(b.dataset.target){target=b.dataset.target;month=(target==="start"?startDate:endDate).slice(0,7);draw();dialog.querySelector('[data-target="'+target+'"]').focus();}
  if(b.dataset.month){const [y,m]=month.split("-").map(Number),d=new Date(y,m-1+Number(b.dataset.month),1);month=localStamp(d).slice(0,7);draw();dialog.querySelector('[data-month="'+b.dataset.month+'"]').focus();}
  if(b.dataset.day){
   if(target==="start"){startDate=b.dataset.day;if(endDate<startDate)endDate=startDate;}
   else endDate=b.dataset.day;
   draw();dialog.querySelector('[data-day="'+b.dataset.day+'"]').focus();
  }
 });
 dialog.addEventListener("change",e=>{
  e.stopPropagation();
  if(e.target.name==="all_day"){allDay=e.target.checked;draw();dialog.querySelector('[name=all_day]').focus();}
  if(e.target.name==="start_time")startTime=e.target.value;
  if(e.target.name==="end_time")endTime=e.target.value;
 });
 dialog.addEventListener("submit",e=>{
  e.preventDefault();e.stopPropagation();
  try{const result=rangeValues(startDate,endDate,startTime,endTime,allDay);onConfirm(result);dialog.close();}
  catch(error){dialog.querySelector("#event-time-error").textContent=error.message;}
 });
 dialog.addEventListener("close",()=>{dialog.remove();if(opener?.isConnected)opener.focus();});
 draw();document.body.append(dialog);dialog.showModal();dialog.querySelector('[name=all_day]').focus();
}
