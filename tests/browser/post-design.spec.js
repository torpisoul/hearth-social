import {test,expect,Hearth,me,friend} from './fixtures.js';

const surface=locator=>locator.evaluate(el=>{const s=getComputedStyle(el);return {shadow:s.boxShadow,radius:s.borderRadius,border:s.borderTopWidth};});
test('posts use one keyboard-friendly reaction picker without dividers or seen controls',async({page,backend},info)=>{
 backend.tables.hearth_statuses=[{id:'design-moment',author:friend,content:'A little sunshine in the garden.',created_at:new Date().toISOString(),topic:'Everyday life',audience:'All kin'}];
 const app=new Hearth(page);await app.signIn();const post=page.locator('.post'),picker=post.locator('.post-reaction'),toggle=picker.locator('[data-soft-toggle]');
 await expect(post.getByRole('button',{name:'Mark moment seen'})).toHaveCount(0);await expect(post.locator('hr')).toHaveCount(0);
 for(const footer of await post.locator('.post-footer').all())expect((await surface(footer)).border).toBe('0px');
 for(const button of await post.locator('.post-action').all()){const s=await surface(button);expect(s.border).toBe('0px');expect(s.shadow).not.toBe('none');}
 await expect(toggle).toHaveText('React');await expect(picker.locator('.soft-options')).toBeHidden();
 await toggle.focus();await page.keyboard.press('Enter');await expect(picker.locator('.soft-options')).toBeVisible();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(page.locator('#notice')).toBeEmpty();await expect(picker.locator('select')).toHaveValue('♥');expect(backend.tables.hearth_post_reactions[0].emoji).toBe('♥');
 await picker.locator('[data-soft-toggle]').click();await page.keyboard.press('Escape');await expect(picker.locator('.soft-options')).toBeHidden();await expect(picker.locator('[data-soft-toggle]')).toBeFocused();
 await picker.locator('[data-soft-toggle]').click();await page.screenshot({path:info.outputPath('reaction-picker.png'),fullPage:true});
});

test('moment pictures share the profile picker surface and group invites use soft controls',async({page,backend},info)=>{
 const app=new Hearth(page);await app.signIn();await page.locator('[data-action="toggle-moment"]').click();
 const upload=page.locator('#moment-composer .file-choice-label');await expect(upload).toHaveText('Choose pictures');const pictureSurface=await surface(upload);
 await page.screenshot({path:info.outputPath('moment-upload.png'),fullPage:true});await app.tab('settings');expect(await surface(page.locator('#avatar .file-choice-label'))).toEqual(pictureSurface);
 await app.tab('parlor');await page.getByRole('button',{name:'Create group chat',exact:true}).click();
 const checkbox=page.locator('#group-chat-create input[type="checkbox"]');await expect(checkbox).toHaveCount(1);expect((await surface(checkbox)).shadow).not.toBe('none');expect((await surface(checkbox)).border).toBe('0px');await checkbox.check();await expect(checkbox).toBeChecked();
 await expect(page.locator('#group-chat-create .soft-choice')).toHaveCount(1);await page.screenshot({path:info.outputPath('group-invites.png'),fullPage:true});
});
