import {defineConfig,devices} from '@playwright/test';

/**
 * Real-browser smoke test: serves the built dist/ through the package's own
 * launcher (start.py), then drives real X_ITE + MuJoCo WASM with actual WebGL
 * in Chromium, Firefox and WebKit. Run `npm run build` first.
 */
const PORT=Number(process.env.SMOKE_PORT??8765);
export default defineConfig({
 testDir:'tests/browser',
 timeout:120_000,
 expect:{timeout:20_000},
 fullyParallel:false,
 workers:1,
 retries:0,
 reporter:[['list'],['json',{outputFile:'test-results/smoke.json'}]],
 use:{baseURL:`http://127.0.0.1:${PORT}/`,acceptDownloads:true,viewport:{width:1440,height:1000},trace:'retain-on-failure'},
 webServer:{command:`python3 start.py --no-browser --port ${PORT}`,url:`http://127.0.0.1:${PORT}/`,reuseExistingServer:false,timeout:30_000},
 projects:[
  {name:'chromium',use:{...devices['Desktop Chrome'],channel:'chromium',viewport:{width:1440,height:1000}}}, // full-browser headless: the default headless shell has no WebGL,
  {name:'firefox',use:{...devices['Desktop Firefox'],viewport:{width:1440,height:1000}}},
  {name:'webkit',use:{...devices['Desktop Safari'],viewport:{width:1440,height:1000}}},
 ],
});
