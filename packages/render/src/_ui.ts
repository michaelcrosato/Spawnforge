import { copyFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const S = '/tmp/claude-0/-home-user-Spawnforge/409f40bb-a83b-5b54-ab74-e313dba6b7e6/scratchpad';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const logs: string[] = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto('http://localhost:5173/?webgl&creature=bog-troll');
await page.waitForTimeout(9000);
await page.locator('#wander').uncheck();
await page.waitForTimeout(1500);
await page.locator('#actions button', { hasText: 'roar' }).click();
await page.waitForTimeout(1300);
await page.screenshot({ path: `${S}/ui-roar.png` });
await page.locator('#toggle-panel').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${S}/ui-sliders.png` });
// Drag a slider: tail length of the troll? use first range in sliders
const slider = page.locator('#tab-sliders input[type=range]').nth(4);
await slider.fill('30');
await page.waitForTimeout(4000);
await page.locator('#panel nav button', { hasText: 'JSON' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${S}/ui-json.png` });
copyFileSync('examples/reed-viper.json', 'creatures/test-viper.json');
await page.waitForTimeout(2500);
await page.locator('#panel nav button', { hasText: 'gallery' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${S}/ui-gallery.png` });
console.log(await page.locator('#status').textContent());
console.log(await page.locator('#events').innerText());
console.log(
  logs
    .filter((l) => !l.includes('[vite]') && !l.includes('GL Driver'))
    .slice(0, 12)
    .join('\n'),
);
await browser.close();
