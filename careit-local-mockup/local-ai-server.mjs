// Local-only ChatGPT plan experiment. No credentials or conversation logs are written to disk.
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import { createWeeklyUsage, weightedUsage } from './weekly-ai-usage.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const host = '127.0.0.1', port = 8767, origin = `http://${host}:${port}`;
const issuer = 'https://auth.openai.com', resource = 'https://api.openai.com/v1';
const authDir = join(root, '.careit-local-auth'), registrationFile = join(authDir, 'registration.json');
const weeklyUsage = createWeeklyUsage(join(authDir, 'weekly-usage.json'));
const scope = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const enc = value => Buffer.from(value).toString('base64url');
const random = () => randomBytes(32).toString('base64url');
let registration = {}, pending = null, session = null, models = [], busy = false, refreshing = null, activeController = null;

try { registration = JSON.parse(readFileSync(registrationFile, 'utf8')); } catch {}
if (typeof registration.hostId !== 'string' || !/^urn:uuid:[a-f0-9-]{36}$/i.test(registration.hostId)) {
  registration = { hostId: `urn:uuid:${randomUUID()}` };
}
function saveRegistration() {
  mkdirSync(authDir, { recursive: true, mode: 0o700 });
  writeFileSync(registrationFile, JSON.stringify(registration), { mode: 0o600 });
}

function send(res, status, value) {
  if (res.destroyed) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function fail(message, code = 'connection_error', status = 400) {
  return Object.assign(new Error(message), { code, status });
}
async function remote(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(30000) }); }
  catch (error) { if (error.name === 'AbortError') throw error; throw fail('OpenAI에 연결하지 못했어요. 네트워크를 확인해 주세요.', 'network_error', 503); }
  if (!response.ok) {
    let details = {}; try { details = await response.json(); } catch {}
    const code = details?.error?.code || details?.error || `http_${response.status}`;
    if (response.status === 401) throw fail('계정 연결을 다시 확인해 주세요.', String(code), 401);
    if (response.status === 403) throw fail('이 계정이나 연결에서 요청이 허용되지 않았어요.', String(code), 403);
    if (response.status === 429) throw fail('사용 한도 또는 크레딧 설정을 확인해 주세요.', String(code), 429);
    throw fail(`OpenAI 요청이 실패했어요. (${response.status})`, String(code), response.status >= 500 ? 503 : 400);
  }
  return response;
}
async function tokenRequest(form) {
  const response = await remote(`${issuer}/api/accounts/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form),
  });
  return response.json();
}
async function verifyIdentity(token, clientId, nonce) {
  if (typeof token !== 'string') throw fail('로그인 정보를 확인할 수 없어요.', 'invalid_identity');
  const parts = token.split('.'); if (parts.length !== 3) throw fail('로그인 정보가 올바르지 않아요.', 'invalid_identity');
  let header, claims;
  try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); claims = JSON.parse(Buffer.from(parts[1], 'base64url')); }
  catch { throw fail('로그인 정보가 올바르지 않아요.', 'invalid_identity'); }
  if (!['RS256', 'ES256'].includes(header.alg) || !header.kid) throw fail('로그인 서명 방식을 확인할 수 없어요.', 'invalid_identity');
  const jwks = await (await remote(`${issuer}/.well-known/jwks.json`)).json();
  const jwk = jwks.keys?.find(key => key.kid === header.kid && (!key.alg || key.alg === header.alg));
  if (!jwk) throw fail('로그인 서명 키를 확인할 수 없어요.', 'invalid_identity');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const signatureValid = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), header.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key, Buffer.from(parts[2], 'base64url'));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);
  if (!signatureValid || claims.iss !== issuer || !audience.includes(clientId) || !claims.sub || !Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf && claims.nbf > now) || (nonce && claims.nonce !== nonce)) {
    throw fail('로그인 정보 검증에 실패했어요.', 'invalid_identity');
  }
  return claims;
}
async function establish(tokens, clientId, nonce, expectedSubject) {
  const identity = await verifyIdentity(tokens.id_token, clientId, nonce);
  if (expectedSubject && identity.sub !== expectedSubject) throw fail('기존에 연결한 계정과 다른 계정이에요.', 'account_mismatch');
  const granted = String(tokens.scope || '').split(/\s+/);
  if (!granted.includes('chatgpt.tokens.use.direct') || !tokens.access_token) throw fail('ChatGPT 요금제 사용이 허용되지 않았어요.', 'plan_not_enabled', 403);
  registration = { hostId: registration.hostId, clientId, subject: identity.sub };
  saveRegistration();
  session = { clientId, subject: identity.sub, email: identity.email || '', accessToken: tokens.access_token, refreshToken: tokens.refresh_token || '', expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000 };
  models = [];
}
async function accessToken() {
  if (!session) throw fail('먼저 ChatGPT 계정을 연결해 주세요.', 'not_connected', 401);
  if (Date.now() < session.expiresAt - 60000) return session.accessToken;
  if (refreshing) return refreshing;
  if (!session.refreshToken) { session = null; throw fail('연결이 만료됐어요. 다시 로그인해 주세요.', 'session_expired', 401); }
  const current = session;
  refreshing=(async()=>{
    const next = await tokenRequest({ grant_type: 'refresh_token', client_id: current.clientId, refresh_token: current.refreshToken, resource });
    current.refreshToken = next.refresh_token || current.refreshToken;
    if (session!==current) throw fail('연결이 해제됐어요.', 'not_connected', 401);
    if (next.id_token) {
      try { const identity = await verifyIdentity(next.id_token, current.clientId); if (identity.sub !== current.subject) throw new Error('identity mismatch'); }
      catch { session = null; throw fail('갱신된 계정을 확인하지 못했어요. 다시 로그인해 주세요.', 'session_expired', 401); }
    }
    if (!next.access_token || (next.scope && !String(next.scope).split(/\s+/).includes('chatgpt.tokens.use.direct'))) { session = null; throw fail('ChatGPT 요금제 사용 권한을 확인해 주세요.', 'plan_not_enabled', 403); }
    current.accessToken = next.access_token; current.expiresAt = Date.now() + Number(next.expires_in || 3600) * 1000;
    return current.accessToken;
  })();
  try { return await refreshing; } finally { refreshing=null; }
}
async function loadModels() {
  const token = await accessToken();
  const result = await (await remote(`${resource}/models`, { headers: { Authorization: `Bearer ${token}` } })).json();
  models = (Array.isArray(result.models) ? result.models : []).filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ slug: m.slug, name: String(m.display_name || m.slug) }));
  return models;
}
const uiTools = [{type:'namespace',name:'careit',description:'케어릿의 현재 화면과 사용자가 요청한 기록을 다루는 로컬 도구',tools:[
  {type:'function',name:'inspect_screen',description:'현재 화면의 입력 항목과 사용 가능한 버튼을 확인합니다. 입력값은 포함하지 않습니다.',parameters:{type:'object',properties:{},required:[],additionalProperties:false},strict:true},
  {type:'function',name:'read_field',description:'사용자가 기존 내용을 읽거나 정리해 달라고 요청한 경우, 현재 화면의 해당 입력란 내용을 확인합니다.',parameters:{type:'object',properties:{target:{type:'string',description:'현재 화면의 입력란 이름'}},required:['target'],additionalProperties:false},strict:true},
  {type:'function',name:'interact',description:'케어릿 페이지 이동, 화면의 버튼 클릭, 입력란 입력 및 선택을 합니다. 먼저 현재 화면을 확인하고 정확한 이름을 사용하세요.',parameters:{type:'object',properties:{action:{type:'string',enum:['navigate','click','fill','select']},target:{type:'string',description:'메뉴명, 버튼명 또는 입력란 이름'},value:{type:'string',description:'입력 내용 또는 선택 항목. 그 외에는 빈 문자열'}},required:['action','target','value'],additionalProperties:false},strict:true},
  {type:'function',name:'search_journals',description:'사용자가 요청한 단어가 들어간 일지를 로컬에서 찾아 날짜와 일부 문맥을 돌려줍니다. 단어는 실제 사용자의 요청에서 가져옵니다.',parameters:{type:'object',properties:{query:{type:'string',description:'찾을 핵심 단어'},person:{type:'string',description:'관리대상 이름. 지정하지 않았으면 빈 문자열'}},required:['query','person'],additionalProperties:false},strict:true},
  {type:'function',name:'open_journal',description:'방금 검색한 일지 중 하나를 오른쪽 화면에 엽니다. 결과가 여러 개면 사용자에게 확인하세요.',parameters:{type:'object',properties:{id:{type:'string',description:'검색 결과의 id'}},required:['id'],additionalProperties:false},strict:true}
]}];
async function infer(body, signal) {
  const token = await accessToken();
  const subject=session.subject,started=Date.now();
  if (!weeklyUsage.get(subject,started).remaining) throw fail('AI 사용량을 모두 사용했어요. 초기화 후 다시 이용할 수 있어요.', 'weekly_limit', 429);
  if (body.model !== 'gpt-6-luna' || !models.some(m => m.slug === 'gpt-6-luna')) throw fail('GPT-6 Luna 사용 권한을 확인해 주세요.', 'invalid_model');
  if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 20 || body.messages.some(m => !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 2000)) throw fail('대화 내용을 확인해 주세요.', 'invalid_message');
  if (!Array.isArray(body.turn || []) || (body.turn || []).length > 40 || JSON.stringify(body.turn || []).length > 40000) throw fail('작업 내용을 확인해 주세요.', 'invalid_turn');
  weeklyUsage.begin(subject,started);
  const instructions = '당신은 케어릿의 로컬 시험용 AI입니다. 사용자의 요청에 따라 careit 도구로 오른쪽 화면을 조작할 수 있습니다. 버튼을 누르거나 입력하기 전에 화면을 확인하고, 도구 결과가 성공일 때만 작업했다고 말하세요. 검색 결과가 여러 개면 대상과 날짜를 보여주고 선택을 요청하세요. 대화와 도구에 나온 사실만 사용하고 관찰, 진단, 교육 결과를 지어내지 마세요. 일지는 사용자 관찰을 대신 만들어내지 말고 요청받은 내용만 입력하거나 정리하세요. 저장이나 삭제는 사용자의 명시적 요청 없이 하지 마세요.';
  const input=[...body.messages.map(m=>({role:m.role,content:m.content})),...(body.turn||[])];
  const response = await remote(`${resource}/responses`, { method:'POST', signal, headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model:body.model, instructions, input, tools:uiTools, parallel_tool_calls:false, store:false, stream:true }) });
  const decoder = new TextDecoder(), reader = response.body.getReader(); let buffer = '', output = '', complete = false, items = [];
  while (true) {
    const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
      const raw = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!raw || raw === '[DONE]') continue;
      let data; try { data = JSON.parse(raw); } catch { throw fail('응답 형식을 확인하지 못했어요.', 'invalid_response', 502); }
      if (data.type === 'response.output_text.delta') output += data.delta || '';
      if (output.length > 30000) throw fail('응답이 너무 길어 중단했어요.', 'response_too_long', 502);
      if (['response.completed','response.failed','response.incomplete'].includes(data.type) && data.response?.usage) {
        let amount;try { amount=weightedUsage(data.response.usage); } catch { throw fail('AI 사용량을 확인하지 못했어요.', 'invalid_usage', 502); }
        try { weeklyUsage.add(subject,amount,started); } catch { throw fail('AI 사용량을 기록하지 못했어요.', 'usage_save_failed', 500); }
      }
      if (data.type === 'response.failed' || data.type === 'response.incomplete' || data.type === 'error') {
        const code = data.response?.error?.code || data.error?.code || data.code || data.type;
        throw fail(/usage|limit/i.test(code)?'사용 한도 또는 크레딧 설정을 확인해 주세요.':'응답을 완료하지 못했어요.', String(code), 502);
      }
      if (data.type === 'response.completed') { if(!data.response?.usage)throw fail('AI 사용량을 확인하지 못했어요.', 'missing_usage', 502);complete = true; items = data.response?.output || []; }
    }
    if (done) break;
  }
  if (!complete) throw fail('응답이 완료되기 전에 연결이 끊겼어요.', 'incomplete', 502);
  return {text:output,output:items,usage:weeklyUsage.get(subject)};
}
async function readBody(req) {
  let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 50000) throw fail('요청이 너무 길어요.', 'too_large', 413); }
  try { return JSON.parse(body || '{}'); } catch { throw fail('요청 형식을 확인해 주세요.', 'invalid_json'); }
}
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  if (req.headers.host !== `${host}:${port}`) return send(res, 403, { error:'허용되지 않은 요청이에요.' });
  let url; try { url = new URL(req.url, origin); } catch { return send(res, 400, { error:'잘못된 요청이에요.' }); }
  // Cross-site access is forbidden for the local API; the OAuth callback validates state and PKCE.
  if (req.headers['sec-fetch-site'] === 'cross-site' && url.pathname.startsWith('/api/local-ai/')) return send(res, 403, { error:'허용되지 않은 요청이에요.' });
  if (url.pathname.startsWith('/api/local-ai/')) {
    if (req.method === 'POST' && (req.headers.origin !== origin || !String(req.headers['content-type'] || '').startsWith('application/json'))) return send(res, 403, { error:'허용되지 않은 요청이에요.' });
    try {
      if (req.method === 'GET' && url.pathname === '/api/local-ai/status') return send(res, 200, { connected:!!session, account:session?.email || '', models, usage:session?weeklyUsage.get(session.subject):null });
      if (req.method !== 'POST') return send(res, 404, { error:'요청을 찾을 수 없어요.' });
      const body = await readBody(req);
      if (url.pathname === '/api/local-ai/connect') {
        saveRegistration();
        const verifier = random(), state = random(), nonce = random(), clientId = registration.clientId || 'dynamic_agent_client';
        pending = { verifier, state, nonce, clientId, subject: registration.subject || '', expiresAt: Date.now() + 10*60*1000 };
        const params = new URLSearchParams({ client_id:clientId, ext_agent_host_id:registration.hostId, response_type:'code', redirect_uri:`${origin}/auth/callback`, scope, resource, state, nonce, code_challenge_method:'S256', code_challenge:enc(createHash('sha256').update(verifier).digest()) });
        if (clientId === 'dynamic_agent_client') params.set('agent_name_hint','케어릿 로컬 시험');
        return send(res, 200, { authorizationUrl:`${issuer}/api/accounts/authorize?${params}` });
      }
      if (url.pathname === '/api/local-ai/models') return send(res, 200, { models:await loadModels() });
      if (url.pathname === '/api/local-ai/disconnect') {
        const previous=session;session=null;models=[];activeController?.abort();
        let revoked=!previous?.refreshToken;
        if (previous?.refreshToken) { try { const config=await (await remote(`${issuer}/.well-known/openid-configuration`)).json();if(new URL(config.revocation_endpoint).origin!==issuer)throw new Error('invalid endpoint');const response=await fetch(config.revocation_endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:previous.refreshToken,token_type_hint:'refresh_token',client_id:previous.clientId}),signal:AbortSignal.timeout(10000)});revoked=response.ok; } catch {} }
        return send(res, 200, { revoked });
      }
      if (url.pathname === '/api/local-ai/respond') {
        if (busy) throw fail('이전 응답을 기다려 주세요.', 'busy', 409);
        busy = true; const controller = new AbortController(), timeout = setTimeout(()=>controller.abort(),120000);activeController=controller;
        // Finish an already started request even if the browser stops waiting, so its usage can be recorded.
        try { return send(res, 200, await infer(body,controller.signal)); } finally { clearTimeout(timeout);busy=false;activeController=null; }
      }
      return send(res, 404, { error:'요청을 찾을 수 없어요.' });
    } catch (error) { return send(res, error.status || 500, { error:error.message || '연결하지 못했어요.', code:error.code || 'error' }); }
  }
  if (url.pathname === '/auth/callback' && req.method === 'GET') {
    let result = 'failed';
    try {
      const attempt=pending;pending=null;
      if(!attempt || Date.now()>attempt.expiresAt || url.searchParams.get('state')!==attempt.state) throw fail('로그인 요청이 만료됐어요.', 'invalid_state');
      if(url.searchParams.has('error')) throw fail('ChatGPT 연결을 취소했어요.', 'access_denied');
      const returned=url.searchParams.get('client_id'),clientId=attempt.clientId==='dynamic_agent_client'?returned:attempt.clientId;
      if(!clientId || (attempt.clientId!=='dynamic_agent_client' && returned && returned!==attempt.clientId) || !url.searchParams.get('code')) throw fail('로그인 결과를 확인하지 못했어요.', 'invalid_callback');
      if(attempt.clientId==='dynamic_agent_client'){registration.clientId=clientId;saveRegistration();}
      const tokens=await tokenRequest({grant_type:'authorization_code',client_id:clientId,code:url.searchParams.get('code'),code_verifier:attempt.verifier,redirect_uri:`${origin}/auth/callback`,resource});
      await establish(tokens,clientId,attempt.nonce,attempt.subject);result='success';
    } catch (error) { result = encodeURIComponent(error.code || 'failed'); }
    res.writeHead(303, { Location:`/careit-mockup.html?local_ai_login=${result}#/`, 'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer' });return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error:'지원하지 않는 요청이에요.' });
  let name; try { name=decodeURIComponent(url.pathname); } catch { return send(res,400,{error:'잘못된 주소예요.'}); }
  if(name==='/') name='/careit-mockup.html';
  if(!/^\/(careit-mockup\.html|device-preview\.html|login\.html|login\.(js|css)|assets\/[A-Za-z0-9_./-]+)$/.test(name) || name.includes('..')) return send(res,404,{error:'파일을 찾을 수 없어요.'});
  const file=resolve(root,'.'+name);if(!file.startsWith(resolve(root)+sep)||!existsSync(file))return send(res,404,{error:'파일을 찾을 수 없어요.'});
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')return res.end();createReadStream(file).on('error',()=>res.destroy()).pipe(res);
});
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) server.listen(port,host,()=>console.log(`Careit local AI test server: ${origin}/careit-mockup.html`));
export { server, verifyIdentity };
