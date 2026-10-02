// Carrega o instantâneo da produção (dados-producao.json, lido só para consulta) no banco falso.
// Depois completa o que um instantâneo antigo não tem (categorias de receitas, itens de Produto Final, receitas 🏁).
;(function(){
const S=window.__SNAP,D=window.__DB;
for(const k of Object.keys(S))D[k]=(S[k]||[]).map(r=>({...r}));
D.profiles=D.profiles.filter(p=>!/TESTE/i.test(p.nome)).map(p=>({tutorial_visto_em:'2026-10-01T00:00:00Z',...p})); // conta de teste fica fora; tutorial já visto (o teste do tutorial liga)
D.config_privada=[];
D.avisos=D.avisos||[];D.avisos_vistos=[];D.registros=[];
})();
;(function(){const D=window.__DB;
if(!(D.categorias_receitas||[]).length)D.categorias_receitas=[{id:'c-dich',nome:'Dichavar',icone:'🌿',ordem:1},{id:'c-enr',nome:'Enrolar',icone:'🚬',ordem:2}];
if(!D.itens.some(i=>i.produto_id))D.produtos.forEach((p,k)=>D.itens.push({id:'pf-'+p.id,nome:p.nome,categoria:'produto_final',unidade_medida:'un',qtd_minima:0,status:p.status,produto_id:p.id,ordem:900+k,criado_em:new Date().toISOString()}));
if(!D.receitas.some(r=>r.produto_final))D.receitas.forEach(r=>{const n=r.nome.toLowerCase();if(n.includes('dichavada'))r.categoria_id='c-dich';else if(/^ba[sd]eado/.test(n)){r.categoria_id='c-enr';r.produto_final=true;
  const cons=D.receita_insumos.filter(x=>x.receita_id===r.id).map(x=>(D.itens.find(i=>i.id===x.item_id)||{}).nome||'').join(' ');
  const p=[...D.produtos].sort((a,b)=>b.nome.length-a.nome.length).find(p=>(r.nome+' '+cons).toLowerCase().includes(p.nome.toLowerCase()));
  if(p)D.receita_insumos.push({id:'ri-'+r.id,receita_id:r.id,item_id:'pf-'+p.id,quantidade:1,tipo:'producao'})}});
// estoque de exemplo para os vídeos de produção
const pac=D.itens.find(i=>i.nome==='Pacote de Blue Dream');D.estoque_bau.push({id:'x-pac',operacao_id:'000127',item_id:pac.id,tipo_movimento:'ajuste_entrada',quantidade:3,status:'ativa',data:new Date().toISOString(),saldo_resultante:3,usuario_id:'3b3f9ab4-50af-4cc5-a264-0b3702759b7c',usuario_nome:'Walter Monteiro',origem:'ajuste manual — por Walter Monteiro'});})();
