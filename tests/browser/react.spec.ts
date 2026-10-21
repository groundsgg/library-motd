import {expect,test} from '@playwright/test';
test('controlled React echoes preserve focus and destroy all DOM on unmount',async({page})=>{
 await page.goto('/tests/browser/react.html');const editor=page.locator('[data-editor-field=motd] .ProseMirror');await expect(editor).toBeVisible();await editor.click();await page.keyboard.press('Control+Home');await page.keyboard.type('React ');
 await expect(editor).toBeFocused();await expect(editor).toContainText('React Editable');
 await page.getByRole('button',{name:'Toggle editor'}).click();await expect(page.locator('.mce-root')).toHaveCount(0);
 await page.getByRole('button',{name:'Toggle editor'}).click();await expect(page.locator('.mce-root')).toHaveCount(1);await expect(editor).toContainText('React Editable');
});
