import { test, expect, Hearth } from './fixtures.js';

test('onboarding moves to the top on Continue and Back, with labelled help', async ({page,backend},testInfo) => {
  backend.user.user_metadata.hearth_onboarding={step:2,complete:false};
  const app=new Hearth(page); await app.signIn();
  await page.getByRole('button',{name:'Continue',exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Whose moments?'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await expect(page.locator('#main')).toBeFocused();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'When should Hearth check in?',level:3})).toBeVisible();
  const checkIn=page.getByRole('button',{name:/^Check-in preference:/});
  await expect(checkIn).toHaveAccessibleDescription(/Choose Refresh/);
  await expect(page.getByRole('button',{name:/^Notification preference:/})).toHaveAccessibleDescription(/small dots/);
  await app.choice('#updates','notification_mode','daily');
  await expect(page.getByLabel('Daily check-in time')).toHaveAccessibleDescription(/time zone/);
  await page.screenshot({path:testInfo.outputPath('onboarding-help.png'),fullPage:true});
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Whose moments?'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
});

test('a photo larger than 5 MB keeps its full proportions and is reduced before saving', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas'); canvas.width=800; canvas.height=400;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='red'; ctx.fillRect(0,0,400,400);
    ctx.fillStyle='blue'; ctx.fillRect(400,0,400,400);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const oversized=Buffer.concat([Buffer.from(png,'base64'),Buffer.alloc(5*1024*1024)]);
  await page.locator('#profile-photo').setInputFiles({name:'large-landscape.png',mimeType:'image/png',buffer:oversized});
  await expect(page.getByRole('button',{name:'Remove picture'})).toBeVisible();
  const saved=backend.tables.hearth_profiles[0].avatar;
  expect(saved.length).toBeLessThan(80000);
  const dimensions=await page.evaluate(async data=>{
    const image=new Image(); image.src=data; await image.decode();
    return [image.naturalWidth,image.naturalHeight];
  },saved);
  expect(dimensions).toEqual([160,80]);
  await expect(page.locator('#avatar').locator('..').locator('img')).toHaveCSS('object-fit','contain');
});

test('Apply spans the card bottom and marks only unsaved choices', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  const apply=page.getByRole('button',{name:'Apply',exact:true});
  await expect(apply).toHaveAccessibleDescription('Your choices are saved.');
  const clean=await apply.evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.locator('[data-topic]').first().click();
  await expect(apply).toHaveAccessibleDescription('You have unsaved choices.');
  expect(await apply.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(clean);
  await page.locator('[data-topic]').first().click();
  await expect(apply).toHaveAccessibleDescription('Your choices are saved.');
  await expect(apply).toHaveCSS('background-color',clean);
  const layout=await apply.evaluate(el=>{
    const card=el.closest('.panel'), style=getComputedStyle(card), box=el.getBoundingClientRect();
    return {width:box.width, available:card.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight), last:el===card.lastElementChild, below:box.top>card.querySelector('[data-action="restore-moments"]').getBoundingClientRect().bottom};
  });
  expect(layout.last && layout.below).toBe(true);
  expect(Math.abs(layout.width-layout.available)).toBeLessThan(2);
});

test('dark palettes persist and offer readable text, then return to light', async ({page,backend},testInfo) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  for(const palette of ['ember','moonlight','night-garden']) {
    await page.locator('[data-palette-choice="'+palette+'"]').click();
    await expect(page.locator('html')).toHaveCSS('color-scheme','dark');
    const selected=page.locator('[data-palette-choice="'+palette+'"]');
    await expect(selected.locator('small')).toHaveCSS('color',await selected.evaluate(el=>getComputedStyle(el).color));
    const ratios=await page.evaluate(()=>{
      const style=getComputedStyle(document.documentElement);
      const luminance=hex=>{
        const channels=hex.trim().slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
        return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
      };
      const contrast=(a,b)=>{const x=luminance(style.getPropertyValue(a)),y=luminance(style.getPropertyValue(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      return [contrast('--ink','--paper'),contrast('--muted','--paper'),contrast('--accent-ink','--accent')];
    });
    for(const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette','night-garden');
  await app.tab('settings');
  await page.locator('.palette-panel').screenshot({path:testInfo.outputPath('dark-palettes.png')});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('dark-preferences.png')});
  await page.locator('[data-palette-choice="hearth"]').click();
  await expect(page.locator('html')).toHaveCSS('color-scheme','light');
});

test('short page title stays fixed while the large introduction scrolls away', async ({page,backend}) => {
  const app=new Hearth(page); await app.signIn(); await app.tab('settings');
  const mobile=await page.locator('.mobile-header').isVisible();
  const title=page.locator(mobile?'.mobile-header':'.desktop-page-header');
  await page.evaluate(()=>scrollTo(0,700));
  expect((await page.locator('.content > .heading').boundingBox()).y).toBeLessThan(0);
  const box=await title.boundingBox();
  expect(box.y).toBe(0);
  if(!mobile) {
    const content=await page.locator('.shell > div').boundingBox();
    expect(Math.abs(box.x+box.width/2-content.x-content.width/2)).toBeLessThan(1);
  }
});

test('Web App install uses a late browser prompt once and respects confirmation', async ({page,backend}) => {
  backend.user.user_metadata.hearth_onboarding={step:5,complete:false};
  const app=new Hearth(page); await app.signIn();
  await expect(page.getByRole('heading',{name:'Hearth, a little closer'})).toBeVisible();
  await page.evaluate(()=>{
    window.installPrompts=0;
    const event=new Event('beforeinstallprompt',{cancelable:true});
    event.prompt=async()=>{window.installPrompts++;return {outcome:'accepted'};};
    window.dispatchEvent(event);
  });
  await page.getByRole('button',{name:'Yes, please!'}).click();
  await expect(page.locator('#web-app-install [role="status"]')).toContainText('setting up');
  expect(await page.evaluate(()=>window.installPrompts)).toBe(1);
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  await expect(page.locator('#web-app-install')).toContainText('already using');
  await expect(page.getByRole('button',{name:'Yes, please!'})).toHaveCount(0);
  await page.getByRole('button',{name:'Make yourself at home'}).click();
  await expect(page.locator('.onboarding')).toHaveCount(0);
});

test('unsupported or declined Web App installation never blocks onboarding', async ({page,backend}) => {
  backend.user.user_metadata.hearth_onboarding={step:5,complete:false};
  const app=new Hearth(page); await app.signIn();
  await page.getByRole('button',{name:'Yes, please!'}).click();
  await expect(page.locator('#web-app-install [role="status"]')).toContainText('Add to Home Screen');
  await page.getByRole('button',{name:'No, thank you.'}).click();
  await expect(page.locator('#web-app-install [role="status"]')).toContainText('Continue using Hearth');
  await page.getByRole('button',{name:'Make yourself at home'}).click();
  await expect(page.locator('.onboarding')).toHaveCount(0);
});

test('dismissed browser installation gives feedback and can be left for later', async ({page,backend}) => {
  backend.user.user_metadata.hearth_onboarding={step:5,complete:false};
  const app=new Hearth(page); await app.signIn();
  await page.evaluate(()=>{
    const event=new Event('beforeinstallprompt',{cancelable:true});
    event.prompt=async()=>({outcome:'dismissed'});
    window.dispatchEvent(event);
  });
  await page.getByRole('button',{name:'Yes, please!'}).click();
  await expect(page.locator('#web-app-install [role="status"]')).toContainText('install the Web App later');
  await page.getByRole('button',{name:'Make yourself at home'}).click();
  await expect(page.locator('.onboarding')).toHaveCount(0);
});
