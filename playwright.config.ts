import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'tests/browser', fullyParallel:true, timeout:20000,
 use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1280,height:900},launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:undefined},
 webServer:{command:'/home/lukas/.volta/bin/npm run dev -- --port 4173',url:'http://127.0.0.1:4173/tests/browser/host.html',reuseExistingServer:true},
 projects:[{name:'chromium',use:{browserName:'chromium'}}],
});
