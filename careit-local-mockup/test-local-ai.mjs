import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import http from 'node:http';
import { server, verifyIdentity } from './local-ai-server.mjs';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format:'jwk' }), kid:'test-key', alg:'RS256' };
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.equal(url, 'https://auth.openai.com/.well-known/jwks.json');
  return new Response(JSON.stringify({ keys:[jwk] }), { status:200 });
};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const makeToken = claims => {
  const data = `${encode({alg:'RS256',kid:'test-key'})}.${encode(claims)}`;
  return `${data}.${sign('sha256',Buffer.from(data),privateKey).toString('base64url')}`;
};
const claims = { iss:'https://auth.openai.com', sub:'test-user', aud:'test-client', nonce:'test-nonce', exp:Math.floor(Date.now()/1000)+300 };
assert.equal((await verifyIdentity(makeToken(claims),'test-client','test-nonce')).sub,'test-user');
await assert.rejects(verifyIdentity(makeToken(claims),'test-client','wrong-nonce'));
await assert.rejects(verifyIdentity(makeToken({...claims,aud:'wrong'}),'test-client','test-nonce'));
await assert.rejects(verifyIdentity(makeToken({...claims,exp:1}),'test-client','test-nonce'));
const badToken = makeToken(claims).split('.'); badToken[2] = Buffer.alloc(256).toString('base64url');
await assert.rejects(verifyIdentity(badToken.join('.'),'test-client','test-nonce'));
globalThis.fetch = originalFetch;

await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const port = server.address().port;
function request(path, {method='GET',headers={},body=''}={}) {
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path,method,headers:{host:'127.0.0.1:8767',...headers}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text}));});
    req.on('error',reject);req.end(body);
  });
}
try {
  const status=await request('/api/local-ai/status');assert.equal(status.status,200);assert.equal(JSON.parse(status.text).connected,false);
  assert.equal((await request('/api/local-ai/respond',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await request('/api/local-ai/respond',{method:'POST',headers:{origin:'http://127.0.0.1:8767','content-type':'application/json'},body:'{}'})).status,401);
  assert.equal((await request('/.careit-local-auth/registration.json')).status,404);
  assert.equal((await request('/api/local-ai/status',{headers:{host:'attacker.example'}})).status,403);
  assert.equal((await request('/api/local-ai/status',{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await request('/auth/callback?state=invalid',{headers:{'sec-fetch-site':'cross-site'}})).status,303);
  assert.equal((await request('/careit-mockup.html',{method:'HEAD',headers:{'sec-fetch-site':'cross-site'}})).status,200);
  console.log('Local AI identity validation and localhost request boundaries: passed');
} finally { await new Promise(resolve => server.close(resolve)); }
