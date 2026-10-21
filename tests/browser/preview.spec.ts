import { expect, test } from '@playwright/test';
test('renders server row, reachable hover and independent lifecycle',async({page})=>{
 await page.goto('/tests/browser/host.html');
 const row=page.locator('#preview .mcp-row');await expect(row).toBeVisible();
 await expect(row).toContainText('42/500');await expect(row).toContainText('Welcome, 42 players');
 await row.getByRole('button',{name:'Online players'}).hover();await expect(page.locator('#preview [role=tooltip]:visible')).toContainText('Ada');
 await page.evaluate(()=>window.preview.destroy());await expect(page.locator('#preview .mcp-row')).toHaveCount(0);await expect(page.locator('#second .mcp-row')).toBeVisible();
});
test('models hidden players and incompatible version without fake hover',async({page})=>{
 await page.goto('/tests/browser/host.html');await page.waitForFunction(()=>!!window.preview);
 await page.evaluate(()=>{window.doc.players.hidden=true;window.preview.update({document:window.doc,context:window.context});});
 await expect(page.locator('#preview .mcp-players')).toHaveText('???');
 await page.evaluate(()=>{window.doc.version={mode:'always',text:window.api.parseText('<red>Maintenance','minimessage').value};window.preview.update({document:window.doc,context:window.context});});
 await expect(page.locator('#preview .mcp-players')).toContainText('Maintenance');
});
