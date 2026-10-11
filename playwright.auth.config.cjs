const {defineConfig,devices}=require('@playwright/test');
const base=require('./playwright.config.cjs');
module.exports=defineConfig(base,{
 testMatch:'auth-reliability.spec.cjs',
 use:{...base.use,channel:undefined},
 projects:[
  {name:'chrome',use:{...devices['Desktop Chrome'],channel:'chrome'}},
  {name:'firefox',use:{...devices['Desktop Firefox']}},
  {name:'mobile-chrome',use:{...devices['Pixel 7'],channel:'chrome'}},
 ],
});
