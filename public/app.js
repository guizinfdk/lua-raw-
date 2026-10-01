const $=id=>document.getElementById(id);
let admin='',current=null,dirty=false,busy=false;
const tell=message=>{$('status').textContent=message;};
async function api(route,method='GET',data){
  const response=await fetch('/api/scripts'+route,{method,headers:{Authorization:'Bearer '+admin,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
  const result=await response.json();if(!response.ok)throw new Error(result.error || 'Falha na solicitação.');return result;
}
async function action(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){tell(e.message);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function allowDiscard(){return !dirty || confirm('Descartar as alterações não salvas?');}
function setResult(row){
  current=row;dirty=false;$('name').value=row.name;$('code').value=row.code;updateSize();$('result').hidden=false;
  const raw=row.base+'/raw/'+row.id;
  $('raw').value=raw+'?key='+row.key;
  $('loader').value='loadstring(game:HttpGet("'+$('raw').value+'"))()';
  $('headerLoader').value='local req = request or http_request or (syn and syn.request)\nassert(req, "Executor sem suporte a request")\nlocal r = req({Url = "'+raw+'", Method = "GET", Headers = {Authorization = "Bearer '+row.key+'"}})\nassert(r.StatusCode == 200, "Acesso negado ou servidor indisponível")\nlocal fn, err = loadstring(r.Body)\nassert(fn, err)\nfn()';
}
async function refresh(){const rows=await api('');$('list').replaceChildren();if(!rows.length){const p=document.createElement('p');p.className='small muted';p.textContent='Nenhum script salvo. Cole seu primeiro código ao lado.';$('list').append(p);}for(const row of rows){const b=document.createElement('button');b.className='item'+(current?.id===row.id?' active':'');b.textContent=row.name;b.onclick=()=>action(async()=>{if(!allowDiscard())return;setResult(await api('/'+row.id));await refresh();tell('Script carregado.');});$('list').append(b);}}
function clear(){current=null;dirty=false;$('editorForm').reset();$('result').hidden=true;for(const id of ['raw','loader','headerLoader'])$(id).value='';updateSize();}
function updateSize(){$('size').textContent=new TextEncoder().encode($('code').value).length.toLocaleString('pt-BR')+' bytes';}
$('loginForm').onsubmit=e=>{e.preventDefault();action(async()=>{admin=$('admin').value;try{await refresh();}catch(e){admin='';throw e;}$('admin').value='';$('login').hidden=true;$('workspace').hidden=false;tell('Painel conectado.');});};
$('editorForm').onsubmit=e=>{e.preventDefault();action(async()=>{const row=await api(current?'/'+current.id:'',current?'PUT':'POST',{name:$('name').value,code:$('code').value});setResult(row);await refresh();tell('Script salvo. Link e loadstring atualizados.');});};
$('code').oninput=()=>{dirty=true;updateSize();};$('name').oninput=()=>dirty=true;
$('new').onclick=()=>action(async()=>{if(!allowDiscard())return;clear();await refresh();$('name').focus();tell('Novo script.');});
$('logout').onclick=()=>{if(!allowDiscard())return;admin='';clear();$('list').replaceChildren();$('login').hidden=false;$('workspace').hidden=true;tell('Você saiu do painel.');};
$('rotate').onclick=()=>action(async()=>{if(!allowDiscard() || !confirm('Renovar a chave? Todos os loadstrings e links antigos deixarão de funcionar.'))return;setResult(await api('/'+current.id+'/rotate','POST'));tell('Chave renovada. Copie o novo loadstring.');});
$('remove').onclick=()=>action(async()=>{if(!confirm('Excluir permanentemente este script? O link deixará de funcionar.'))return;await api('/'+current.id,'DELETE');clear();await refresh();tell('Script excluído.');});
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const el=$(b.dataset.copy);try{await navigator.clipboard.writeText(el.value);tell('Copiado!');}catch{el.focus();el.select();tell('Selecionei o conteúdo. Use Ctrl+C ou a opção Copiar do celular.');}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
if(location.protocol==='file:')tell('Abra pelo servidor: http://localhost:3000. Este HTML precisa do servidor incluído.');
