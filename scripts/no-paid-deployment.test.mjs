import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('production local-only configs omit the paid AI credential and preserve feed/timeout limits', () => {
 const workflow=fs.readFileSync('.github/workflows/worker-pipeline.yml','utf8').split('\n  deploy:')[1];
 for(const name of ['AI_PROVIDER_FALLBACK_TO_OPENAI','NUTSNEWS_ALLOW_OPENAI_FALLBACK_DEPLOYMENT']) assert.match(workflow,new RegExp(name+': "false"'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nutsnews-no-paid-'));
 try {
 const result=spawnSync(process.execPath,['scripts/generate-wrangler-config.mjs'],{cwd:'worker',encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME,NUTSNEWS_GENERATED_WRANGLER_DIR:dir,NUTSNEWS_SECRETS_STORE_ID:'fixture-store',NUTSNEWS_KV_NAMESPACE_ID:'fixture-kv',LOCAL_AI_URL:'https://local-ai.invalid',LOCAL_AI_API_KEY_SECRET_NAME:'LOCAL_AI_API_KEY',AI_PROVIDER:'local',AI_PROVIDER_FALLBACK_TO_OPENAI:'false',NUTSNEWS_ALLOW_OPENAI_FALLBACK_DEPLOYMENT:'false',SHARD_COUNT:'25',RSS_FEED_FETCH_TIMEOUT_MS:'15000',ARTICLE_PAGE_FETCH_TIMEOUT_MS:'10000',LOCAL_AI_TIMEOUT_MS:'15000',OPENAI_TIMEOUT_MS:'30000'}});
 assert.equal(result.status,0,result.stderr);
 const files=fs.readdirSync(dir).filter(f=>/^wrangler.shard\d+.jsonc$/.test(f));assert.equal(files.length,25);
 for(const file of files){const c=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));assert.equal(c.vars.AI_PROVIDER_FALLBACK_TO_OPENAI,'false');assert.equal(c.vars.FEEDS_PER_SHARD,'20');assert.equal(c.vars.LOCAL_AI_TIMEOUT_MS,'15000');assert(!c.secrets_store_secrets.some(s=>s.binding==='OPENAI_API_KEY'));assert(c.secrets_store_secrets.some(s=>s.binding==='LOCAL_AI_API_KEY'));}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
