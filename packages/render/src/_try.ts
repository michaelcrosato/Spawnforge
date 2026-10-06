import { readFileSync, writeFileSync } from 'node:fs';
import { Renderer } from './index.ts';
const r = await Renderer.launch();
for (const name of process.argv.slice(2)) {
  const t = performance.now();
  const out = await r.render({ blueprint: JSON.parse(readFileSync(`examples/${name}.json`, 'utf8')), labels: true, size: 400, ...(process.env.DEBUG ? { debug: JSON.parse(process.env.DEBUG) } : {}) });
  writeFileSync(`/tmp/claude-0/-home-user-Spawnforge/409f40bb-a83b-5b54-ab74-e313dba6b7e6/scratchpad/sheet-${name}.png`, out.png);
  console.log(name, ((performance.now() - t) / 1000).toFixed(1) + 's', JSON.stringify(out.info));
}
await r.close();
