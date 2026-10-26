/*
 * Painel do computador: mesmas tarefas do app, em colunas.
 *
 * Lê e grava direto no dados.json pelo servidor do iniciar.pyw (não usa a memória do
 * navegador). Antes de cada mudança busca a lista atual do arquivo, para não desfazer
 * o que foi feito na janela pequena do app enquanto o painel estava aberto.
 */

const API_TAREFAS = 'api/tarefas';
const DIAS_FEITAS = 7;

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** @typedef {{id:string, titulo:string, data:string, hora:string, obs:string, feita:boolean, criadoEm:number}} Tarefa */

/** @type {Tarefa[]} */
let tarefas = [];

/** id da tarefa aberta na janela de edição. */
let editandoId = null;

/* ==================== datas ==================== */

function paraISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function deISO(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12);
}

function hojeISO() {
  return paraISO(new Date());
}

function somarDias(iso, dias) {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

function diasEntre(deIso, ateIso) {
  return Math.round((deISO(ateIso) - deISO(deIso)) / 86400000);
}

/** "2026-10-27" -> "ter, 27/10" (ano só quando não é o atual) */
function dataCurta(iso) {
  const [ano, mes, dia] = iso.split('-');
  const sufixoAno = ano === hojeISO().slice(0, 4) ? '' : `/${ano}`;
  return `${DIAS_CURTOS[deISO(iso).getDay()]}, ${dia}/${mes}${sufixoAno}`;
}

function nomeDoDia(iso) {
  const diff = diasEntre(hojeISO(), iso);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  return DIAS_SEMANA[deISO(iso).getDay()];
}

function distancia(iso) {
  const diff = diasEntre(hojeISO(), iso);
  if (diff > 1) return `em ${diff} dias`;
  if (diff < -1) return `há ${-diff} dias`;
  if (diff === -1) return 'ontem';
  return '';
}

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

/* ==================== arquivo ==================== */

/** @returns {Tarefa} */
function normalizar(item, i) {
  return {
    id: String(item.id || gerarId()),
    titulo: String(item.titulo || ''),
    data: String(item.data || ''),
    hora: String(item.hora || ''),
    obs: String(item.obs || ''),
    feita: Boolean(item.feita),
    criadoEm: Number(item.criadoEm) || i,
  };
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** @returns {Promise<Tarefa[]>} */
async function buscar() {
  const resposta = await fetch(API_TAREFAS, { cache: 'no-store' });
  if (!resposta.ok || resposta.headers.get('X-Sollers-Work') !== '1') {
    throw new Error('servidor do SOLLERS WORK não respondeu');
  }
  const { tarefas: lista } = await resposta.json();
  return Array.isArray(lista) ? lista.map(normalizar).filter((t) => t.titulo) : [];
}

async function gravar(lista) {
  const resposta = await fetch(API_TAREFAS, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lista),
  });
  if (!resposta.ok) throw new Error(String(resposta.status));
}

/**
 * Busca a lista mais nova, aplica a mudança, grava e redesenha.
 * @param {(lista: Tarefa[]) => void} mudanca
 */
async function mudar(mudanca, mensagem) {
  try {
    const lista = await buscar();
    mudanca(lista);
    await gravar(lista);
    tarefas = lista;
    mostrarAviso(false);
    render();
    if (mensagem) mostrarToast(mensagem);
  } catch {
    mostrarAviso(true);
    mostrarToast('⚠ Não gravou. Abra o painel pelo atalho da Área de Trabalho.');
  }
}

async function atualizar() {
  try {
    tarefas = await buscar();
    mostrarAviso(false);
  } catch {
    mostrarAviso(true);
  }
  render();
}

function mostrarAviso(mostrar) {
  document.getElementById('aviso-servidor').hidden = !mostrar;
}

/* ==================== separação ==================== */

function porHorario(a, b) {
  if (a.data !== b.data) return a.data.localeCompare(b.data);
  if (a.hora !== b.hora) return a.hora.localeCompare(b.hora);
  return a.criadoEm - b.criadoEm;
}

function separar(lista) {
  const hoje = hojeISO();
  const limiteFeitas = somarDias(hoje, -(DIAS_FEITAS - 1));
  const comData = lista.filter((t) => t.data).sort(porHorario);
  const semData = lista.filter((t) => !t.data).sort((a, b) => a.criadoEm - b.criadoEm);

  return {
    atrasadas: comData.filter((t) => t.data < hoje && !t.feita),
    hoje: comData.filter((t) => t.data === hoje),
    proximas: comData.filter((t) => t.data > hoje && !t.feita),
    semData: semData.filter((t) => !t.feita),
    // feitas: dos últimos dias (e de dias futuros já adiantadas) e as sem data concluídas
    feitas: [
      ...comData.filter((t) => t.feita && t.data >= limiteFeitas),
      ...semData.filter((t) => t.feita),
    ],
  };
}

function agruparPorDia(lista) {
  const grupos = new Map();
  for (const t of lista) {
    if (!grupos.has(t.data)) grupos.set(t.data, []);
    grupos.get(t.data).push(t);
  }
  return grupos;
}

/* ==================== desenho ==================== */

/** @param {Tarefa} t @param {{mostrarQuando?: boolean}} opcoes */
function criarCartao(t, opcoes = {}) {
  const cartao = document.createElement('div');
  cartao.className = 'cartao' + (t.feita ? ' feita' : '');
  cartao.draggable = true;
  cartao.dataset.id = t.id;

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check';
  check.textContent = t.feita ? '✓' : '';
  check.title = t.feita ? 'Reabrir' : 'Concluir';
  check.addEventListener('click', () => {
    mudar((lista) => {
      const alvo = lista.find((x) => x.id === t.id);
      if (alvo) alvo.feita = !alvo.feita;
    }, t.feita ? 'Tarefa reaberta.' : 'Feito! ✓');
  });

  const corpo = document.createElement('div');
  corpo.className = 'cartao-corpo';

  const linha = document.createElement('div');
  linha.className = 'cartao-linha';
  if (t.data && t.hora) {
    const hora = document.createElement('span');
    hora.className = 'cartao-hora';
    hora.textContent = t.hora;
    linha.appendChild(hora);
  }
  const titulo = document.createElement('span');
  titulo.className = 'cartao-titulo';
  titulo.textContent = t.titulo;
  linha.appendChild(titulo);
  corpo.appendChild(linha);

  if (opcoes.mostrarQuando && t.data) {
    const quando = document.createElement('div');
    quando.className = 'cartao-quando';
    quando.textContent = `${dataCurta(t.data)} · ${distancia(t.data)}`;
    corpo.appendChild(quando);
  }

  if (t.obs) {
    const obs = document.createElement('div');
    obs.className = 'cartao-obs';
    obs.textContent = t.obs;
    corpo.appendChild(obs);
  }

  const acoes = document.createElement('div');
  acoes.className = 'cartao-acoes';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.textContent = '✏️';
  btnEditar.title = 'Editar';
  btnEditar.addEventListener('click', () => abrirEdicao(t));

  const btnExcluir = document.createElement('button');
  btnExcluir.type = 'button';
  btnExcluir.textContent = '×';
  btnExcluir.title = 'Excluir';
  btnExcluir.addEventListener('click', () => pedirExclusao(btnExcluir, t));

  acoes.append(btnEditar, btnExcluir);
  cartao.append(check, corpo, acoes);

  cartao.addEventListener('dblclick', (ev) => {
    if (ev.target.closest('button')) return;
    abrirEdicao(t);
  });

  cartao.addEventListener('dragstart', (ev) => {
    ev.dataTransfer.setData('text/plain', t.id);
    ev.dataTransfer.effectAllowed = 'move';
    cartao.classList.add('arrastando');
  });
  cartao.addEventListener('dragend', () => cartao.classList.remove('arrastando'));

  return cartao;
}

function preencher(idLista, lista, opcoes) {
  const el = document.getElementById(idLista);
  el.innerHTML = '';
  for (const t of lista) el.appendChild(criarCartao(t, opcoes));
}

function criarGrupoDia(data, lista, { soltar } = {}) {
  const grupo = document.createElement('div');
  grupo.className = 'grupo';
  if (soltar) grupo.dataset.soltar = `dia:${data}`;

  const topo = document.createElement('div');
  topo.className = 'grupo-topo';

  const nome = document.createElement('span');
  nome.className = 'grupo-nome';
  nome.textContent = data ? nomeDoDia(data) : '📌 Sem data';

  const info = document.createElement('span');
  info.className = 'grupo-info';
  const dist = data ? distancia(data) : '';
  info.textContent = data ? dataCurta(data) + (dist && soltar ? ` · ${dist}` : '') : '';

  topo.append(nome, info);

  const ul = document.createElement('div');
  ul.className = 'lista';
  for (const t of lista) ul.appendChild(criarCartao(t));

  grupo.append(topo, ul);
  return grupo;
}

function render() {
  const hoje = hojeISO();
  const s = separar(tarefas);

  // topo
  const d = deISO(hoje);
  document.getElementById('hoje-extenso').textContent =
    `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

  const limiteSemana = somarDias(hoje, 6);
  const pendHoje = s.hoje.filter((t) => !t.feita).length;
  const pendSemana = [...s.hoje, ...s.proximas].filter((t) => !t.feita && t.data <= limiteSemana).length;

  document.getElementById('cont-atrasadas').textContent = s.atrasadas.length;
  document.getElementById('cont-atrasadas-box').classList.toggle('tem', s.atrasadas.length > 0);
  document.getElementById('cont-hoje').textContent = pendHoje;
  document.getElementById('cont-semana').textContent = pendSemana;
  document.getElementById('cont-semdata').textContent = s.semData.length;
  document.getElementById('cont-feitas').textContent = s.feitas.length;

  // coluna hoje
  document.getElementById('grupo-atrasadas').hidden = s.atrasadas.length === 0;
  document.getElementById('info-atrasadas').textContent = plural(s.atrasadas.length, 'pendente', 'pendentes');
  preencher('lista-atrasadas', s.atrasadas, { mostrarQuando: true });
  preencher('lista-hoje', s.hoje);
  document.getElementById('vazio-hoje').hidden = s.hoje.length + s.atrasadas.length > 0;

  // coluna próximos: só os dias que têm tarefa
  const proximos = document.getElementById('lista-proximos');
  proximos.innerHTML = '';
  for (const [data, lista] of agruparPorDia(s.proximas)) {
    proximos.appendChild(criarGrupoDia(data, lista, { soltar: true }));
  }
  document.getElementById('vazio-proximos').hidden = s.proximas.length > 0;

  // coluna sem data
  preencher('lista-semdata', s.semData);
  document.getElementById('vazio-semdata').hidden = s.semData.length > 0;

  // coluna feitas: mais recentes primeiro, sem data no fim
  const feitas = document.getElementById('lista-feitas');
  feitas.innerHTML = '';
  const comData = s.feitas.filter((t) => t.data);
  const semData = s.feitas.filter((t) => !t.data);
  for (const [data, lista] of [...agruparPorDia(comData)].reverse()) {
    feitas.appendChild(criarGrupoDia(data, lista));
  }
  if (semData.length > 0) feitas.appendChild(criarGrupoDia('', semData));
  document.getElementById('vazio-feitas').hidden = s.feitas.length > 0;
}

/* ==================== arrastar e soltar ==================== */

/** Para onde o cartão foi solto -> o que muda na tarefa. */
function aplicarDestino(tarefa, destino) {
  if (destino === 'feita') {
    tarefa.feita = true;
    return 'Feito! ✓';
  }
  tarefa.feita = false;
  if (destino === 'semdata') {
    tarefa.data = '';
    tarefa.hora = '';
    return '📌 Movido para Sem data.';
  }
  const data = destino === 'hoje' ? hojeISO() : destino.slice(4);
  tarefa.data = data;
  return `Marcado para ${nomeDoDia(data).toLowerCase()}.`;
}

function configurarArrastar() {
  let alvoAtual = null;

  const marcar = (el) => {
    if (alvoAtual === el) return;
    if (alvoAtual) alvoAtual.classList.remove('alvo');
    alvoAtual = el;
    if (el) el.classList.add('alvo');
  };

  // o grupo de um dia (mais específico) ganha da coluna em que está
  const destinoDe = (ev) => ev.target.closest('[data-soltar]');

  document.addEventListener('dragover', (ev) => {
    const el = destinoDe(ev);
    if (!el) { marcar(null); return; }
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    marcar(el);
  });

  document.addEventListener('dragend', () => marcar(null));

  document.addEventListener('drop', (ev) => {
    const el = destinoDe(ev);
    marcar(null);
    if (!el) return;
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/plain');
    const destino = el.dataset.soltar;
    let mensagem = '';
    mudar((lista) => {
      const tarefa = lista.find((t) => t.id === id);
      if (tarefa) mensagem = aplicarDestino(tarefa, destino);
    }).then(() => { if (mensagem) mostrarToast(mensagem); });
  });
}

/* ==================== lançar e editar ==================== */

function configurarLancar() {
  const form = document.getElementById('form-lancar');
  const campoData = document.getElementById('novo-data');
  campoData.value = hojeISO();

  document.querySelectorAll('[data-novo-dias]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const dias = botao.dataset.novoDias;
      campoData.value = dias === '' ? '' : somarDias(hojeISO(), Number(dias));
      document.getElementById('novo-titulo').focus();
    });
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const titulo = document.getElementById('novo-titulo').value.trim();
    if (!titulo) return;
    const data = campoData.value;
    const tarefa = {
      id: gerarId(),
      criadoEm: Date.now(),
      titulo,
      data,
      hora: data ? document.getElementById('novo-hora').value : '',
      obs: document.getElementById('novo-obs').value.trim(),
      feita: false,
    };
    mudar((lista) => lista.push(tarefa),
      data ? `Marcado para ${nomeDoDia(data).toLowerCase()}!` : '📌 Guardado em Sem data!')
      .then(() => {
        // fica o dia escolhido, para lançar várias seguidas no mesmo dia
        document.getElementById('novo-titulo').value = '';
        document.getElementById('novo-hora').value = '';
        document.getElementById('novo-obs').value = '';
        document.getElementById('novo-titulo').focus();
      });
  });
}

function abrirEdicao(t) {
  editandoId = t.id;
  document.getElementById('ed-titulo').value = t.titulo;
  document.getElementById('ed-data').value = t.data;
  document.getElementById('ed-hora').value = t.hora;
  document.getElementById('ed-obs').value = t.obs;
  document.getElementById('dlg-editar').showModal();
  document.getElementById('ed-titulo').focus();
}

function configurarEdicao() {
  const dlg = document.getElementById('dlg-editar');

  document.querySelectorAll('[data-ed-dias]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const dias = botao.dataset.edDias;
      document.getElementById('ed-data').value = dias === '' ? '' : somarDias(hojeISO(), Number(dias));
      if (dias === '') document.getElementById('ed-hora').value = '';
    });
  });

  document.getElementById('ed-cancelar').addEventListener('click', () => dlg.close());

  document.getElementById('form-editar').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const titulo = document.getElementById('ed-titulo').value.trim();
    if (!titulo) return;
    const data = document.getElementById('ed-data').value;
    const id = editandoId;
    dlg.close();
    mudar((lista) => {
      const alvo = lista.find((t) => t.id === id);
      if (!alvo) return;
      alvo.titulo = titulo;
      alvo.data = data;
      alvo.hora = data ? document.getElementById('ed-hora').value : '';
      alvo.obs = document.getElementById('ed-obs').value.trim();
    }, 'Tarefa atualizada!');
  });

  document.getElementById('ed-excluir').addEventListener('click', () => {
    const id = editandoId;
    if (!confirm('Excluir esta tarefa?')) return;
    dlg.close();
    mudar((lista) => {
      const i = lista.findIndex((t) => t.id === id);
      if (i >= 0) lista.splice(i, 1);
    }, 'Tarefa excluída.');
  });
}

/** Primeiro clique no × pede confirmação no próprio botão, o segundo exclui. */
function pedirExclusao(botao, t) {
  if (botao.dataset.confirmando === 'sim') {
    mudar((lista) => {
      const i = lista.findIndex((x) => x.id === t.id);
      if (i >= 0) lista.splice(i, 1);
    }, 'Tarefa excluída.');
    return;
  }
  botao.dataset.confirmando = 'sim';
  botao.textContent = 'Excluir?';
  botao.classList.add('confirmando');
  setTimeout(() => {
    botao.dataset.confirmando = 'nao';
    botao.textContent = '×';
    botao.classList.remove('confirmando');
  }, 4000);
}

function mostrarToast(mensagem) {
  const toast = document.getElementById('toast');
  toast.textContent = mensagem;
  toast.hidden = false;
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
}

/* ==================== início ==================== */

configurarLancar();
configurarEdicao();
configurarArrastar();
atualizar();

// mudanças feitas na janela pequena do app e virada do dia aparecem sozinhas
window.addEventListener('focus', atualizar);
setInterval(() => {
  if (!document.getElementById('dlg-editar').open) atualizar();
}, 60000);
