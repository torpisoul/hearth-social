// Keep native form values while presenting choices as keyboard-friendly buttons.
export function enhanceChoices(root=document) {
 for(const select of root.querySelectorAll('select:not([data-soft-ready])')) {
  select.dataset.softReady='true'; select.hidden=true;
  const label=select.closest('label');
  const caption=label?.firstChild?.textContent.trim() || select.name;
  if(label) {
   const field=document.createElement('div');field.className=label.className;
   field.append(...label.childNodes);label.replaceWith(field);
  }
  const box=document.createElement('div');box.className='soft-choice';
  select.parentNode.insertBefore(box,select);box.append(select);
  const trigger=document.createElement('button');trigger.type='button';trigger.dataset.softToggle='';
  trigger.setAttribute('aria-expanded','false');
  const options=document.createElement('div');options.className='soft-options';options.hidden=true;
  options.id=`choice-${select.form?.id || 'page'}-${select.name}`;
  options.setAttribute('role','group');options.setAttribute('aria-label',caption);
  trigger.setAttribute('aria-controls',options.id);
  const update=()=>{const value=select.selectedOptions[0]?.textContent || '';trigger.textContent=value;trigger.setAttribute('aria-label',`${caption}: ${value}`);};
  update();box.append(trigger,options);
  for(const option of select.options) {
   const b=document.createElement('button');b.type='button';b.dataset.softOption=option.value;
   b.textContent=option.textContent;b.disabled=option.disabled;
   b.setAttribute('aria-pressed',String(select.value===option.value));options.append(b);
  }
  select.addEventListener('change',update);
 }
}
export function closeChoices(except=null) {
 for(const box of document.querySelectorAll('.soft-choice')) {
  if(box===except) continue;
  box.querySelector('.soft-options').hidden=true;
  box.querySelector('[data-soft-toggle]').setAttribute('aria-expanded','false');
 }
}
export function choiceClick(event) {
 const box=event.target.closest('.soft-choice');closeChoices(box);
 const b=event.target.closest('button');if(!box||!b) return false;
 const trigger=box.querySelector('[data-soft-toggle]'),options=box.querySelector('.soft-options');
 if(b.hasAttribute('data-soft-toggle')) {
  options.hidden=!options.hidden;trigger.setAttribute('aria-expanded',String(!options.hidden));
  if(!options.hidden) options.querySelector('[aria-pressed="true"]')?.focus();
 } else if(b.hasAttribute('data-soft-option')) {
  const select=box.querySelector('select');select.value=b.dataset.softOption;
  options.querySelectorAll('button').forEach(option=>option.setAttribute('aria-pressed',String(option===b)));
  for(const type of ['input','change']) select.dispatchEvent(new select.ownerDocument.defaultView.Event(type,{bubbles:true}));
  closeChoices();trigger.focus();
 }
 return true;
}
export function choiceKey(event) {
 const box=event.target.closest('.soft-choice');if(!box)return;
 if(event.key==='Escape') {event.preventDefault();closeChoices();box.querySelector('[data-soft-toggle]').focus();}
 if(['ArrowDown','ArrowUp'].includes(event.key)&&!box.querySelector('.soft-options').hidden) {
  event.preventDefault();const buttons=[...box.querySelectorAll('.soft-options button:not(:disabled)')];
  const index=buttons.indexOf(document.activeElement);
  buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
 }
}
