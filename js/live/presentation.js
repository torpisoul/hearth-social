export function relativeTime(value,now=Date.now()) {
 const elapsed=Math.max(0,now-new Date(value).getTime());
 if(!Number.isFinite(elapsed)) return '';
 if(elapsed<60000)return 'Just now';
 if(elapsed<3600000)return `${Math.floor(elapsed/60000)}m ago`;
 if(elapsed<86400000)return `${Math.floor(elapsed/3600000)}h ago`;
 if(elapsed<604800000)return `${Math.floor(elapsed/86400000)}d ago`;
 return new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
}
export function calendarParts(event) {
 const date=new Date(event.starts_at);
 if(!Number.isFinite(+date))return null;
 const zone=event.all_day?{timeZone:event.time_zone || 'UTC'}:{};
 return {day:new Intl.DateTimeFormat(undefined,{day:'numeric',...zone}).format(date),month:new Intl.DateTimeFormat(undefined,{month:'short',...zone}).format(date)};
}
export function sortConversations(ids,activity,name) {
 return [...ids].sort((a,b)=>(activity[b]||0)-(activity[a]||0)||name(a).localeCompare(name(b),undefined,{sensitivity:'base'})||a.localeCompare(b));
}
export async function conversationActivity(client,owner,ids) {
 const activity={};
 // Each request is bounded to one metadata row; no message content is fetched.
 for(let offset=0;offset<ids.length;offset+=5) {
  await Promise.all(ids.slice(offset,offset+5).map(async person=>{
   const {data,error}=await client.from('hearth_messages').select('created_at')
    .or(`and(sender.eq.${owner},recipient.eq.${person}),and(sender.eq.${person},recipient.eq.${owner})`)
    .order('created_at',{ascending:false}).limit(1);
   if(error)throw error;
   activity[person]=Date.parse(data?.[0]?.created_at)||0;
  }));
 }
 return activity;
}
