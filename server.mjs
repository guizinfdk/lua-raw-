import http from 'node:http';
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync, unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const ADMIN = process.env.ADMIN_KEY || '';
const PORT = Number(process.env.PORT || 3000);
const BASE = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
if (ADMIN.length < 32) throw new Error('Defina ADMIN_KEY com pelo menos 32 caracteres aleatórios. Consulte LEIA-ME.md.');
if (!/^https?:\/\/[^/?#]+$/.test(BASE)) throw new Error('PUBLIC_URL deve conter somente a origem, sem caminho.');
mkdirSync(DIR, {recursive:true, mode:0o700});
const digest = s => createHash('sha256').update(s).digest();
const equal = (a,b) => timingSafeEqual(digest(a),digest(b));
const token = () => randomBytes(32).toString('hex');
const filename = id => path.join(DIR, `${id}.json`);
const valid = id => /^[a-f0-9]{32}$/.test(id);
const read = id => valid(id) && existsSync(filename(id)) ? JSON.parse(readFileSync(filename(id),'utf8')) : null;
function save(row) {
  const temporary = `${filename(row.id)}.tmp`;
  writeFileSync(temporary, JSON.stringify(row), {mode:0o600});
  renameSync(temporary, filename(row.id));
}
function send(res,status,data,type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function summary(row) { return {id:row.id,name:row.name,updated:row.updated}; }
async function body(req) {
  let size=0; const chunks=[];
  for await (const chunk of req) {
    size += chunk.length;
    if(size>600000) { const e = new Error('Código muito grande. Limite: 512 KB.'); e.status=413; throw e; }
    chunks.push(chunk);
  }
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch {const e=new Error('JSON inválido.');e.status=400;throw e;}
}
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, BASE);
    const raw = /^\/raw\/([a-f0-9]{32})$/.exec(url.pathname);
    if(raw) {
      if(req.method!=='GET') return send(res,405,{error:'Método não permitido.'});
      // Filtro de navegação: conveniência, não prova de identidade do cliente.
      if(req.headers['sec-fetch-mode']==='navigate' || req.headers['sec-fetch-dest']==='document' || (req.headers.accept || '').includes('text/html'))
        return send(res,403,'Abertura no navegador bloqueada.','text/plain; charset=utf-8');
      const row=read(raw[1]);
      const key=(req.headers.authorization || '').replace(/^Bearer /,'') || url.searchParams.get('key') || '';
      if(!row || !equal(key,row.key)) return send(res,403,'Acesso negado.','text/plain; charset=utf-8');
      return send(res,200,row.code,'text/plain; charset=utf-8');
    }
    if(url.pathname.startsWith('/api/')) {
      if(!equal(req.headers.authorization || '',`Bearer ${ADMIN}`)) return send(res,401,{error:'Chave administrativa inválida.'});
      if(req.headers.origin && req.headers.origin!==BASE) return send(res,403,{error:'Origem não permitida. Confira PUBLIC_URL.'});
      const match = /^\/api\/scripts\/([a-f0-9]{32})(\/rotate)?$/.exec(url.pathname);
      if(url.pathname==='/api/scripts' && req.method==='GET') {
        const list=readdirSync(DIR).filter(f=>/^[a-f0-9]{32}\.json$/.test(f)).map(f=>summary(JSON.parse(readFileSync(path.join(DIR,f),'utf8'))));
        return send(res,200,list.sort((a,b)=>b.updated.localeCompare(a.updated)));
      }
      if(match) {
        const row=read(match[1]); if(!row) return send(res,404,{error:'Script não encontrado.'});
        if(req.method==='GET' && !match[2]) return send(res,200,{...row,base:BASE});
        if(req.method==='DELETE' && !match[2]) {unlinkSync(filename(row.id));return send(res,200,{ok:true});}
        if(req.method==='POST' && match[2]) {row.key=token();row.updated=new Date().toISOString();save(row);return send(res,200,{...row,base:BASE});}
      }
      if((url.pathname==='/api/scripts' && req.method==='POST') || (match && !match[2] && req.method==='PUT')) {
        const data=await body(req);
        if(typeof data.name!=='string' || !data.name.trim() || data.name.length>80 || typeof data.code!=='string' || !data.code.trim() || Buffer.byteLength(data.code)>524288)
          return send(res,400,{error:'Informe nome (até 80 caracteres) e código Lua (até 512 KB).'});
        if(!match && readdirSync(DIR).filter(f=>f.endsWith('.json')).length>=100) return send(res,409,{error:'Limite de 100 scripts atingido.'});
        const row=match ? read(match[1]) : {id:randomBytes(16).toString('hex'),key:token()};
        if(!row) return send(res,404,{error:'Script não encontrado.'});
        Object.assign(row,{name:data.name.trim(),code:data.code,updated:new Date().toISOString()});save(row);
        return send(res,match?200:201,{...row,base:BASE});
      }
      return send(res,404,{error:'Rota não encontrada.'});
    }
    const assets={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
    if(req.method==='GET' && assets[url.pathname]) {
      const [file,type]=assets[url.pathname]; return send(res,200,readFileSync(path.join(ROOT,'public',file)),type);
    }
    send(res,404,{error:'Não encontrado.'});
  } catch(e) {send(res,e.status || 500,{error:e.status ? e.message : 'Não foi possível concluir. Verifique o armazenamento do servidor.'});}
});
server.requestTimeout=15000; server.headersTimeout=10000;
server.listen(PORT, process.env.HOST || '127.0.0.1',()=>console.log(`Lua Raw disponível em ${BASE}`));
