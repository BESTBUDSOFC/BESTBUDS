// Cliente Supabase falso para testes de UI (em memória)
(function(){
  const U=(n)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
  const DB=window.__DB={
    profiles:[
      {id:U(1),nome:'Zeca',usuario:'zeca',perfil:'vendedor',status:'ativo',troca_senha_obrigatoria:false,tutorial_visto_em:'2026-01-01T00:00:00Z',criado_em:'2026-01-01'},
      {id:U(2),nome:'walter',usuario:'walter',perfil:'socio',status:'ativo',troca_senha_obrigatoria:false,tutorial_visto_em:'2026-01-01T00:00:00Z',criado_em:'2026-01-02'},
      {id:U(3),nome:'Ana',usuario:'ana',perfil:'gerente',status:'ativo',troca_senha_obrigatoria:false,tutorial_visto_em:'2026-01-01T00:00:00Z',criado_em:'2026-01-03'},
      {id:U(4),nome:'Bruno',usuario:'bruno',perfil:'vendedor',status:'ativo',troca_senha_obrigatoria:false,tutorial_visto_em:'2026-01-01T00:00:00Z',criado_em:'2026-01-04'},
      {id:U(5),nome:'Carla',usuario:'carla',perfil:'diretor',status:'ativo',troca_senha_obrigatoria:false,tutorial_visto_em:'2026-01-01T00:00:00Z',criado_em:'2026-01-05'},
      {id:U(6),nome:'Abel',usuario:'abel',perfil:'socio',status:'ativo',troca_senha_obrigatoria:false,tutorial_visto_em:'2026-01-01T00:00:00Z',criado_em:'2026-01-06'},
    ],
    produtos:[{id:'pr1',nome:'Produto 1',preco:10,rateio:'padrao',ordem:1,status:'ativo'},{id:'pr2',nome:'Produto 2',preco:20,rateio:'padrao',ordem:2,status:'ativo'}],
    itens:[
      {id:U(101),nome:'Pacote A',categoria:'materia_prima',unidade_medida:'un',preco_unitario:100,qtd_minima:0,status:'ativo'},
      {id:U(102),nome:'Pacote B',categoria:'materia_prima',unidade_medida:'un',preco_unitario:200,qtd_minima:0,status:'ativo'},
      {id:U(103),nome:'Seda',categoria:'insumo_auxiliar',unidade_medida:'un',preco_unitario:5,qtd_minima:0,status:'ativo'},
      {id:U(104),nome:'Item Livre',categoria:'insumo_auxiliar',unidade_medida:'un',preco_unitario:1,qtd_minima:0,status:'ativo'},
      {id:U(106),nome:'Dichavada D',categoria:'produto_nao_acabado',unidade_medida:'g',preco_unitario:0,qtd_minima:0,status:'ativo'},
      {id:U(107),nome:'Baseado Final',categoria:'produto_final',unidade_medida:'un',preco_unitario:0,qtd_minima:0,status:'ativo',produto_id:'pr1'},
      {id:U(105),nome:'Fita',categoria:'insumo_auxiliar',unidade_medida:'un',preco_unitario:1,qtd_minima:0,status:'ativo'},
    ],
    receitas:[{id:U(201),nome:'Receita X',ordem:1,status:'ativo'},{id:U(202),nome:'Dichavar',ordem:2,status:'ativo',categoria_id:U(802)},{id:U(203),nome:'Enrolar',ordem:3,status:'ativo',categoria_id:U(801),produto_final:true}],
    categorias_receitas:[{id:U(801),nome:'Enrolados',icone:'🚬',ordem:2},{id:U(802),nome:'Dichavados',icone:'🌿',ordem:1}],
    receita_insumos:[{id:U(301),receita_id:U(201),item_id:U(101),quantidade:1,tipo:'consumo'},{id:U(302),receita_id:U(202),item_id:U(101),quantidade:1,tipo:'consumo'},{id:U(303),receita_id:U(202),item_id:U(106),quantidade:2,tipo:'producao'},{id:U(304),receita_id:U(203),item_id:U(106),quantidade:1,tipo:'consumo'},{id:U(305),receita_id:U(203),item_id:U(103),quantidade:1,tipo:'consumo'},{id:U(306),receita_id:U(203),item_id:U(107),quantidade:1,tipo:'producao'}],
    fornecedores:[
      {id:U(401),nome:'Forn Um',status:'ativo',documento:'x',contato:'y'},
      {id:U(402),nome:'Forn Dois',status:'ativo'},
      {id:U(403),nome:'Forn Tres',status:'ativo'},
    ],
    fornecedor_itens:[
      {id:U(501),fornecedor_id:U(401),item_id:U(101),preco_unitario:100},
      {id:U(502),fornecedor_id:U(401),item_id:U(102),preco_unitario:200},
      {id:U(503),fornecedor_id:U(402),item_id:U(102),preco_unitario:210},
    ],
    parcerias:[{id:'pc1',nome:'Parceria B',tipo:'fixa',desconto_fixo:10,ordem:2,status:'ativo'},{id:'pc2',nome:'Parceria A',tipo:'fixa',desconto_fixo:5,ordem:1,status:'ativo'}],parceria_faixas:[],taxas_deslocamento:[{id:'tx1',nome:'Centro',valor:10,ordem:1,status:'ativo'},{id:'tx2',nome:'Bairro',valor:20,ordem:2,status:'ativo'}],
    vendas:[
      {id:U(601),operacao_id:'000101',data:'2026-09-20T10:00:00Z',status:'ativa',total:10,subtotal:10,desconto:0,cota_funcionario:0,receita_loja:10,taxa_valor:0,usuario_nome:'walter'},
      {id:U(602),data:'2026-09-21T10:00:00Z',status:'revertida',total:20,subtotal:20,desconto:0,cota_funcionario:0,receita_loja:20,taxa_valor:0,usuario_nome:'walter'},
    ],
    venda_itens:[],
    compras:[
      {id:U(701),data:'2026-09-22T10:00:00Z',status:'ativa',valor_total:5,fornecedor_nome:'Forn Um',usuario_nome:'walter'},
      {id:U(702),data:'2026-09-23T10:00:00Z',status:'revertida',valor_total:7,fornecedor_nome:'Forn Um',usuario_nome:'walter'},
    ],
    compra_itens:[],estoque_bau:[],ajustes_caixa:[],registros:[],
    categorias_itens:[
      {codigo:'materia_prima',nome:'Matéria-Prima',controla_estoque:true,compravel:true,aparece_receitas:true,ordem:1},
      {codigo:'insumo_auxiliar',nome:'Insumo Auxiliar',controla_estoque:true,compravel:true,aparece_receitas:true,ordem:2},
      {codigo:'produto_nao_acabado',nome:'Produto Não Acabado',controla_estoque:true,compravel:false,aparece_receitas:true,ordem:3},
      {codigo:'produto_final',nome:'Produto Final',controla_estoque:false,compravel:false,aparece_receitas:true,ordem:4},
    ],
    solicitacoes_senha:[{id:'ped-1',usuario_id:U(4),usuario:'bruno',status:'pendente',criado_em:'2026-09-25T10:00:00Z'},{id:'ped-2',usuario_id:U(6),usuario:'abel',status:'pendente',criado_em:'2026-09-25T11:00:00Z'}],
    config_privada:[{id:1,senha_padrao_reset:null}],
    configuracoes:[{id:1,nome_loja:'BEST BUDS',cores:{},aliquota_global:50}],
    discord_canais:[{canal:'avisos',ativo:false,webhook_definido:false,cargos:[]},{canal:'ouro',ativo:false,webhook_definido:false,cargos:[]}],
    discord_mensagens:[],discord_segredos:[],
  };
  let seq=1000;
  window.__LOG=[];
  function builder(table){
    const st={table,op:'select',filters:[],payload:null,single:false,maybe:false,count:null,head:false,sel:'*'};
    const match=r=>st.filters.every(([k,op,v])=>op==='eq'?r[k]===v:op==='in'?v.includes(r[k]):true);
    const b={
      select(sel,opts){if(st.op==='select')st.sel=sel||'*';if(opts&&opts.count){st.count=opts.count;st.head=!!opts.head}st.returning=true;return b},
      insert(p){st.op='insert';st.payload=p;return b},
      upsert(p,o){st.op='upsert';st.payload=p;st.onConflict=(o&&o.onConflict||'id').split(',');return b},
      update(p){st.op='update';st.payload=p;return b},
      delete(){st.op='delete';return b},
      eq(k,v){st.filters.push([k,'eq',v]);return b},
      in(k,v){st.filters.push([k,'in',v]);return b},
      order(k,o){(st.ord=st.ord||[]).push([k,o&&o.ascending===false]);return b},limit(){return b},range(a,z){st.range=[a,z];return b},
      single(){st.single=true;return b},maybeSingle(){st.maybe=true;return b},
      then(res,rej){return Promise.resolve(run()).then(res,rej)}
    };
    function run(){
      const T=DB[table]=DB[table]||[];
      if(table==='profiles')T.forEach(u=>{u.perfil_acesso=u.perfil_acesso||(window.__perfilDe&&window.__perfilDe[u.id])||u.perfil});
      window.__LOG.push({table,op:st.op,filters:st.filters,payload:st.payload});
      let data;
      if(st.op==='select'){
        data=T.filter(match);
        if(table==='receita_insumos'&&st.sel.includes('receitas('))data=data.map(r=>({...r,receitas:{nome:(DB.receitas.find(x=>x.id===r.receita_id)||{}).nome}}));
        if(st.head)return{data:null,count:data.length,error:null};
        if(table==='registros'&&st.ord)data=data.slice().sort((x,y)=>String(y.data).localeCompare(String(x.data)));
        const total=data.length;if(st.range)data=data.slice(st.range[0],st.range[1]+1);
        if(st.count&&!st.single&&!st.maybe)return{data,count:total,error:null};
      }else if(st.op==='insert'){
        const arr=(Array.isArray(st.payload)?st.payload:[st.payload]).map(r=>table==='categorias_itens'?{...r}:({id:'gen-'+(seq++),status:['ajustes_caixa','vendas','compras','estoque_bau'].includes(table)?'ativa':'ativo',...r}));
        if(table==='fornecedor_itens'){for(const r of arr){const it=DB.itens.find(i=>i.id===r.item_id);const c=it&&DB.categorias_itens.find(c=>c.codigo===it.categoria);if(!c||!c.compravel)return{data:null,error:{message:'categoria invalida'}}}}
        if(table==='avisos')arr.forEach(r=>{delete r.status;r.criado_em=new Date().toISOString();r.tipo='manual';r.referencia=null;   // trigger avisos_definir_autor
          const h=('duracao_horas' in r)?r.duracao_horas:(r.duracao_horas=24);r.expira_em=h===null?'infinity':new Date(Date.now()+h*36e5).toISOString()});
        if(table==='avisos')arr.forEach(r=>{const c=r.tipo==='vendedor_semana'?'ouro':'avisos',cfg=DB.discord_canais.find(x=>x.canal===c);   // trigger discord_aviso_novo
          if(!cfg||!cfg.ativo||!cfg.webhook_definido)return;
          const ids=cfg.cargos.filter(x=>r.discord_cargos==null?x.padrao:r.discord_cargos.includes(x.id)).map(x=>x.id);
          DB.discord_mensagens.push({id:'gen-'+(seq++),aviso_id:r.id,canal:c,titulo:r.titulo,cargos:ids,status:'pendente',tentativas:0,teste:false,criado_em:new Date().toISOString()})});
        if(table==='avisos_vistos')arr.forEach(r=>{delete r.status;delete r.id});
        if(table==='vendas')arr.forEach(r=>{r.data=r.data||new Date().toISOString();r.status='pendente';r.guardada_em=null;r.deposito_id=null;r.cancelamento_status=null});
        if(table==='estoque_bau')arr.forEach(r=>{r.data=r.data||new Date().toISOString();r.status=r.status||'ativa'});
        T.push(...arr);data=arr;
      }else if(st.op==='upsert'){
        data=[];
        for(const r of (Array.isArray(st.payload)?st.payload:[st.payload])){
          const ex=T.find(x=>st.onConflict.every(k=>x[k]===r[k]));
          if(ex){Object.assign(ex,r);data.push(ex)}else{const n={id:'gen-'+(seq++),...r};T.push(n);data.push(n)}
        }
      }else if(st.op==='update'){
        data=T.filter(match);
        // trigger trg_produto_preco: cada mudança de preço vira uma linha em produtos_precos, com o preço anterior
        if(table==='produtos'&&st.payload&&'preco' in st.payload)data.forEach(r=>{if(Number(r.preco)!==Number(st.payload.preco))(DB.produtos_precos=DB.produtos_precos||[]).push({id:'gen-'+(seq++),produto_id:r.id,preco:Number(st.payload.preco),preco_anterior:Number(r.preco),alterado_em:new Date().toISOString()})});
        if(table==='discord_canais'){const eu=DB.profiles.find(p=>p.id===(window.__uid||U(2)))||{};if(!['socio','diretor'].includes(eu.perfil))data=[];
          data.forEach(r=>{Object.assign(r,st.payload,{webhook_definido:r.webhook_definido,atualizado_em:new Date().toISOString(),atualizado_por_nome:eu.nome})});
          if(st.single||st.maybe)return{data:data[0]||null,error:data[0]?null:{message:'sem permissão'}};return{data,error:null}}
        data.forEach(r=>Object.assign(r,st.payload));
      }else if(st.op==='delete'){
        data=T.filter(match);
        if(table==='itens'){const ids=data.map(r=>r.id);if(DB.receita_insumos.some(r=>ids.includes(r.item_id)))return{data:null,error:{message:'violates foreign key constraint'}}}
        if(table==='avisos'){const ids=data.map(r=>r.id);DB.discord_mensagens.forEach(m=>{if(m.canal==='avisos'&&ids.includes(m.aviso_id)&&['enviado','pendente','erro'].includes(m.status))m.status=m.status==='enviado'?'apagar':'cancelado'})}   // trigger discord_avisos_sairam
        DB[table]=T.filter(r=>!match(r));
      }
      if(st.single||st.maybe)return{data:data[0]||null,error:null};
      return{data,error:null};
    }
    return b;
  }
  DB.avatares=DB.avatares||[];
  // v4.39: perfis configuráveis (mesmos padrões da migração 20261012000000); window.__perfisExtra acrescenta perfis
  const TODAS=['painel','vendas_equipe','caixa_ajustes','bau_gerir','excluir_lancamentos','avisos','catalogo','itens','receitas','fornecedores','descontos','excluir_cadastros','usuarios','usuarios_excluir','perfis','ranking','identidade','discord'];
  DB.perfis_acesso=DB.perfis_acesso||[
    {id:'socio',nome:'Sócio',cor:'ouro',ordem:1,permissoes:TODAS},
    {id:'diretor',nome:'Diretor',cor:'azul',ordem:2,permissoes:TODAS.filter(x=>x!=='perfis')},
    {id:'gerente',nome:'Gerente',cor:'roxo',ordem:3,permissoes:['painel','vendas_equipe','caixa_ajustes','bau_gerir','avisos','catalogo','itens','receitas','fornecedores','descontos','usuarios','ranking','identidade']},
    {id:'vendedor',nome:'Vendedor',cor:'verde',ordem:4,permissoes:[]},...(window.__perfisExtra||[])];
  window.supabase={createClient(u,k,opts){window.__sbOpts=opts;return{
    from:builder,
    rpc:async(nome,args)=>{window.__LOG.push({rpc:nome,args});
      const uid=window.__uid||U(2),eu=DB.profiles.find(p=>p.id===uid)||{},nivel={vendedor:1,gerente:2,diretor:3,socio:4}[eu.perfil]||0;
      const erro=m=>({data:null,error:{message:m}});
      if(nome==='discord_salvar_webhook'){
        if(nivel<3)return erro('Apenas Sócio ou Diretor configuram o Discord.');
        const u=String(args.p_url||'').trim();
        if(u&&!/^https:\/\/(ptb\.|canary\.)?(discord|discordapp)\.com\/api(\/v[0-9]+)?\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/.test(u))return erro('Endereço de webhook inválido.');
        const c=DB.discord_canais.find(x=>x.canal===args.p_canal);if(!c)return erro('Canal inválido.');
        DB.discord_segredos=DB.discord_segredos.filter(x=>x.canal!==args.p_canal);if(u)DB.discord_segredos.push({canal:args.p_canal,webhook:u});
        c.webhook_definido=!!u;return{data:null,error:null};
      }
      if(nome==='guardar_vendas'){
        const vs=DB.vendas.filter(v=>args.p_ids.includes(v.id));
        if(!vs.length||vs.length!==new Set(args.p_ids).size)return erro('Venda não encontrada.');
        if(vs.some(v=>v.status!=='pendente'))return erro('Alguma venda selecionada já foi guardada ou cancelada. Atualize a tela.');
        if(vs.some(v=>v.cancelamento_status==='pedido'))return erro('Há venda com pedido de cancelamento em aberto. Aguarde a resposta do gerente.');
        if(nivel<2&&vs.some(v=>v.usuario_id!==uid))return erro('Vendedor só guarda as próprias vendas.');
        const n=x=>vs.reduce((s,v)=>s+Number(v[x]||0),0);
        const dep={id:'dep-'+(seq++),operacao_id:String(seq++).padStart(6,'0'),data:new Date().toISOString(),usuario_id:uid,usuario_nome:eu.nome,qtd_vendas:vs.length,total_vendas:n('total'),repasse:n('cota_funcionario'),valor_caixa:n('receita_loja')};
        (DB.depositos_caixa=DB.depositos_caixa||[]).push(dep);
        vs.forEach(v=>Object.assign(v,{status:'ativa',guardada_em:dep.data,deposito_id:dep.id}));
        return{data:dep,error:null};
      }
      if(nome==='pedir_cancelamento_venda'){
        const v=DB.vendas.find(x=>x.id===args.p_id);if(!v)return erro('Venda não encontrada.');
        if(v.usuario_id!==uid)return erro('Só quem registrou a venda pode pedir o cancelamento.');
        if(v.status!=='pendente')return erro('Só venda pendente (ainda não guardada) pode ter cancelamento pedido.');
        if(v.cancelamento_status==='pedido')return erro('O cancelamento desta venda já foi pedido.');
        Object.assign(v,{cancelamento_status:'pedido',cancelamento_motivo:args.p_motivo.trim(),cancelamento_pedido_por_nome:eu.nome});return{data:null,error:null};
      }
      if(nome==='responder_cancelamento_venda'){
        if(nivel<2)return erro('Apenas Gerente, Diretor ou Sócio respondem pedidos de cancelamento.');
        const v=DB.vendas.find(x=>x.id===args.p_id);if(!v||v.status!=='pendente'||v.cancelamento_status!=='pedido')return erro('Esta venda não tem pedido de cancelamento em aberto.');
        Object.assign(v,{status:args.p_aprovar?'revertida':'pendente',cancelamento_status:args.p_aprovar?'aprovado':'recusado',cancelamento_respondido_por_nome:eu.nome});return{data:null,error:null};
      }
      return{data:'OP-'+(seq++),error:null}},
    auth:{getSession:async()=>({data:{session:window.__semSessao?null:{access_token:'token-falso',user:{id:window.__uid||U(2)}}}}),signOut:async()=>({}),signInWithPassword:async()=>({data:{user:{id:window.__uid||U(2)}},error:null})},
    storage:{from(){const ST=window.__ST=window.__ST||{files:[],removidos:[]};return{
      upload:async(c,f)=>{ST.files.push({name:c,size:f.size,type:f.type,f,created_at:new Date().toISOString()});return{}},
      getPublicUrl:c=>({data:{publicUrl:'https://zwnawcnurwbowtdkholm.supabase.co/storage/v1/object/public/midia/'+c}}),
      list:async(pasta,o)=>({data:ST.files.filter(x=>x.name.startsWith(pasta+'/')).map(x=>({name:x.name.slice(pasta.length+1),created_at:x.created_at})),error:null}),
      remove:async(cs)=>{ST.removidos.push(...cs);ST.files=ST.files.filter(x=>!cs.includes(x.name));return{data:cs,error:null}}}}},
    functions:{invoke:async()=>({data:{},error:null})},
    channel(nome,opts){const ch={_h:[],_state:{},on(ev,f,cb){this._h.push({ev,f,cb});return this},
      subscribe(cb){if(nome==='presenca'){window.__pres=this;if(cb)setTimeout(()=>cb('SUBSCRIBED'),0)}else window.__rt=this;return this},
      track(d){window.__tracked=d;return Promise.resolve('ok')},untrack(){return Promise.resolve('ok')},
      presenceState(){return this._state},
      _sync(ids){this._state=Object.fromEntries(ids.map(i=>[i,[{usuario_id:i}]]));this._h.filter(h=>h.ev==='presence').forEach(h=>h.cb())}};return ch},
    __opts:null,
  }}};
})();
