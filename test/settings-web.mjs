import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
// This opt-in test always allocates its own home and never uses an existing profile.
const cli=process.env.DSH_TEST_CLI;
const tarball=process.env.STAGE_PROSE_TEST_PACKAGE;
assert(cli&&tarball,'Set DSH_TEST_CLI to a DSH bin.js entry and STAGE_PROSE_TEST_PACKAGE to a local candidate tarball.');
const root=await mkdtemp(join(tmpdir(),'dsh-stage-prose-settings-web-'));
const home=join(root,'home');
const environment={...process.env,DSH_HOME:home};
console.log('Isolated evidence: '+root);
const installation=spawnSync(process.execPath,[cli,'plugin','--profile','web','add','file:'+resolve(tarball),'--save-exact'],{env:environment,windowsHide:true,stdio:'inherit'});
assert.equal(installation.status,0,'Isolated package installation failed');
const profile=join(home,'profiles/web');
const data=join(home,'plugin-data/dsh-stage-prose');
const workspace=join(root,'deepseek-harness/default-workspace');
const requests=[];
const progress='Stage Prose tested progress.';
const final='Stage Prose tested final.';
const reminder='UI_REMINDER_20261127';
let releaseFinal; const finalGate=new Promise(resolve=>releaseFinal=resolve);
const model='stage-test';
const server=createServer(async(req,res)=>{
 try {
 let raw='';for await(const c of req)raw+=c;
 const input=JSON.parse(raw);
 const read=input.tools?.find(t=>t.function?.name==='read');
 if(!read){
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  res.end('data: '+JSON.stringify({id:'title',object:'chat.completion.chunk',created:1,model,choices:[{index:0,delta:{role:'assistant',content:'Stage regression'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');return;
 }
 const n=requests.length+1;
 requests.push({guidance:JSON.stringify(input.messages).includes('UI_GUIDANCE_20261127'),tail:JSON.stringify(input.messages).includes('UI_TAIL_20261127'),n,stage:JSON.stringify(input.messages).includes(reminder),timeline:JSON.stringify(input.messages).includes('Task progress checkpoint:'),toolResults:input.messages.filter(m=>m.role==='tool').length});
 console.log(JSON.stringify(requests.at(-1)));
 assert(n<=5);
 if(n===5)await finalGate;
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const send=(delta,finish_reason=null)=>res.write('data: '+JSON.stringify({id:'step-'+n,object:'chat.completion.chunk',created:1,model,choices:[{index:0,delta,finish_reason}]})+'\n\n');
 send({role:'assistant'});
 if(n<5){
  send({reasoning_content:'Checking fixture '+n});
  if(n===4)send({content:progress});
  send({tool_calls:[{index:0,id:'read-'+n,type:'function',function:{name:'read',arguments:JSON.stringify({file_path:'fixture.txt'})}}]});
  send({},'tool_calls');
 }else{send({content:final});send({},'stop');}
 res.end('data: [DONE]\n\n');
 }catch(e){console.error(e);if(!res.headersSent)res.writeHead(500);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let host,browser,page;const logs=[];let result;
try{
 await mkdir(workspace,{recursive:true});await mkdir(data,{recursive:true});
 await writeFile(join(workspace,'fixture.txt'),'stage fixture\n');
 await writeFile(join(data,'settings.json'),JSON.stringify({schemaVersion:1,everySteps:7,custom:'preserve-me'}));
 const config=[
 '- id: llm-pi-ai','  config:','    providers:','      stage-fixture:','        apiKeyEnv: STAGE_FIXTURE_KEY','        api: openai-completions','        baseURL: http://127.0.0.1:'+server.address().port+'/v1','        compat:','          thinkingFormat: deepseek','        models:','          - id: '+model,'            name: Stage Test Model','            contextWindow: 65536','            maxTokens: 4096',
 '- id: agent-default-model','  config:','    provider: stage-fixture','    model: '+model,
 '- id: workspace-controller','  config:','    documentsDirectory: '+JSON.stringify(root),
 '- id: locale','  config:','    preference: zh'
 ];
 if(process.env.STAGE_TIMELINE==='true')config.push('- insert:','    - id: stage-test-timeline','      name: "@deepseek-ai/dsh-timeline"','      config:','        reportsEnabled: false','        reminderIterations: 3');
 await writeFile(join(profile,'cordis.patch.yml'),config.join('\n')+'\n');
 host=spawn(process.execPath,[cli,'--profile','web','--host','127.0.0.1','--port','0','--no-open'],{cwd:workspace,env:{...environment,STAGE_FIXTURE_KEY:'local-fixture'},windowsHide:true});
 const url=await new Promise((resolve,reject)=>{
  let output='';const timer=setTimeout(()=>reject(Error('Startup timeout '+logs.join('').slice(-3000))),240000);
  host.on('exit',c=>{clearTimeout(timer);reject(Error('Host exit '+c+' '+logs.join('').slice(-3500)));});
  for(const stream of [host.stdout,host.stderr])stream.on('data',c=>{
   output+=c;logs.push(String(c).replace(/token=[^\s]+/g,'token=[redacted]'));
   const m=output.match(/dsh web:\s*(http:\/\/127\.0\.0\.1:\d+\/[^\s]*)/);
   if(m){clearTimeout(timer);resolve(m[1]);}
  });
 });
 browser=await chromium.launch({executablePath:process.env.STAGE_PROSE_CHROMIUM});page=await browser.newPage();
 const errors=[];
 page.on('pageerror',error=>{errors.push(error.message);console.error('BROWSER ERROR '+error.message);});
 await page.goto(url);
 await page.locator('[contenteditable=true]').last().waitFor({timeout:45000});
 const notice=page.getByRole('dialog',{name:/Preview Notice|预览/});
 if(await notice.isVisible())await notice.getByRole('button',{name:/Continue|继续/}).click();
 await page.getByRole('button',{name:/^(Plugins|插件)$/}).click();
 await page.getByText(/^(Stage Prose|阶段输出)$/).last().click({timeout:120000});
 const form=page.locator('.dsh-stage-prose-settings');
 const steps=form.getByRole('spinbutton',{name:'连续静默步数'});
 await steps.waitFor({timeout:20000});
 assert.equal(await steps.inputValue(),'7');
 assert.equal(await form.locator('details').getAttribute('open'),null);
 const disk=async()=>JSON.parse(await readFile(join(data,'settings.json'),'utf8'));
 const save=async()=>{await form.getByRole('button',{name:'保存设置',exact:true}).click();await form.getByRole('status').filter({hasText:'设置已保存'}).waitFor();};
 const backups=(await readdir(data)).filter(x=>x.endsWith('.bak'));
 assert.equal(backups.length,1);
 assert.equal(await readFile(join(data,backups[0]),'utf8'),JSON.stringify({schemaVersion:1,everySteps:7,custom:'preserve-me'}));
 assert.equal((await disk()).schemaVersion,2);
 await form.getByRole('checkbox',{name:'静默提醒',exact:true}).uncheck();
 await steps.fill('2');
 await form.getByRole('checkbox',{name:'完成后保留阶段正文'}).check();
 await form.getByRole('checkbox',{name:'与 Timeline 协同'}).uncheck();await save();
 assert.equal((await disk()).custom,'preserve-me');assert.equal((await disk()).enabled,false);
 assert.equal(await page.locator('style#dsh-stage-prose').count(),1);
 await form.getByRole('checkbox',{name:'静默提醒',exact:true}).check();
 await form.getByRole('checkbox',{name:'完成后保留阶段正文'}).uncheck();
 await form.getByRole('checkbox',{name:'与 Timeline 协同'}).check();await save();
 assert.equal(await page.locator('style#dsh-stage-prose').count(),0);
 await form.getByText('高级设置',{exact:true}).click();
 await form.getByRole('textbox',{name:'尾部进度指导',exact:true}).fill('UI_TAIL_20261127');
 await form.getByRole('textbox',{name:'英文静默提醒',exact:true}).fill(reminder);
 await form.getByRole('textbox',{name:'中文静默提醒',exact:true}).fill('UI_中文提醒_20261127');
 await form.getByRole('checkbox',{name:'调试日志',exact:true}).check();
 const guidance=form.getByRole('textbox',{name:'主提示词 guidance.md',exact:true});
 await guidance.fill('UI_GUIDANCE_20261127');await save();
 assert.equal(await guidance.inputValue(),'UI_GUIDANCE_20261127');
 assert.notEqual(await readFile(join(data,'guidance.md'),'utf8'),'UI_GUIDANCE_20261127');
 await form.getByRole('button',{name:'保存主提示词',exact:true}).click();
 await form.getByRole('status').filter({hasText:'主提示词已保存'}).waitFor();
 assert.equal(await readFile(join(data,'guidance.md'),'utf8'),'UI_GUIDANCE_20261127');
 await writeFile(join(data,'settings.json'),JSON.stringify({...await disk(),everySteps:4}));
 await writeFile(join(data,'guidance.md'),'UI_GUIDANCE_20261127 manual');
 await page.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='4',null,{timeout:15000});
 assert.equal(await guidance.inputValue(),'UI_GUIDANCE_20261127 manual');
 await steps.fill('5');
 await writeFile(join(data,'settings.json'),JSON.stringify({...await disk(),everySteps:6}));
 await form.getByRole('button',{name:'保存设置',exact:true}).click();
 await form.getByRole('alert').filter({hasText:'文件已有其他修改'}).waitFor();
 await page.waitForTimeout(5500);assert.equal(await steps.inputValue(),'5');assert.equal((await disk()).everySteps,6);
 page.once('dialog',dialog=>dialog.accept());await form.getByRole('button',{name:'重新读取'}).click();
 await page.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='6');
 await steps.fill('2');await save();
 await page.reload();await page.getByRole('button',{name:/^(Plugins|插件)$/}).click();await page.getByText(/^(Stage Prose|阶段输出)$/).last().click({timeout:120000});await page.getByRole('spinbutton',{name:'连续静默步数'}).waitFor();
 assert.equal(await steps.inputValue(),'2');assert.equal((await disk()).everySteps,2);
 await form.scrollIntoViewIfNeeded();
 await form.screenshot({path:join(root,'settings-common.png')});
 const unauth=await fetch(new URL('/api/dsh-stage-prose/read',page.url()),{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
 assert.equal(unauth.status,401);
 const cookies=(await page.context().cookies()).map(x=>x.name+'='+x.value).join('; ');
 const wrongOrigin=await fetch(new URL('/api/dsh-stage-prose/read',page.url()),{method:'POST',headers:{'content-type':'application/json',cookie:cookies,origin:'https://untrusted.invalid'},body:'{}'});
 assert.equal(wrongOrigin.status,403);
 await page.getByRole('button',{name:/^(New session|New chat|新对话|新会话|新建会话|新建对话)$/}).first().click();
 await page.locator('[contenteditable=true]').last().fill('Please read fixture.txt, report progress, then finish.');
 await page.getByRole('button',{name:/^(Send message|发送消息)$/}).click();
 await page.getByText(progress,{exact:true}).waitFor({timeout:45000});
 const row=page.locator('[data-chat-flow-kind="assistant-step"]').filter({hasText:progress}).last();
 assert.equal(await row.evaluate(el=>getComputedStyle(el).contentVisibility),'visible');
 releaseFinal();
 await page.getByText(final,{exact:true}).waitFor({timeout:45000});
 await page.waitForTimeout(300);
 const visibility=await row.evaluate(el=>getComputedStyle(el).contentVisibility);
 assert.equal(visibility,'hidden');
 const foldedRows=await page.locator('[data-chat-flow-kind="tool-call"],[data-chat-flow-kind="assistant-step"][data-chat-group-part="reasoning"]').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).contentVisibility));
 assert.equal(foldedRows.length,8);
 assert(foldedRows.every(value=>value==='hidden'));
 const diag=await readFile(join(data,'diagnostics.log'),'utf8');
 result={migration:true,separateSaves:true,manualReload:true,conflictDraftPreserved:true,reloadPersistence:true,unauthorized:unauth.status,wrongOrigin:wrongOrigin.status,requests,liveProgress:true,completedProgress:visibility,foldedRows,nudges:diag.match(/nudge session=/g)?.length??0,errors};
 assert.equal(requests.length,5);assert.deepEqual(requests.map(x=>x.toolResults),[0,1,2,3,4]);
 assert.deepEqual(requests.map(x=>x.stage),[false,false,true,true,true]);
 assert(requests.every(x=>x.guidance&&x.tail));assert.equal(result.nudges,1);assert.deepEqual(errors,[]);
 console.log('RESULT '+JSON.stringify(result));
}catch(e){console.error(e.stack);if(page)console.error((await page.locator('body').ariaSnapshot()).slice(-5000));process.exitCode=1;}
finally{
 await mkdir(root,{recursive:true});await writeFile(join(root,'proof.json'),JSON.stringify({result,requests,logs},null,2));
 if(browser)await browser.close();if(host)host.kill();
 server.closeAllConnections();server.close();
}
