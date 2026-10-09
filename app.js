const VERSAO = '1.0.3';
const STORAGE_KEY = 'agendei.tarefas';

/** @typedef {{id:string, titulo:string, data:string, hora:string, obs:string, feita:boolean, criadoEm:number}} Tarefa */

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const TITULOS = {
  agenda: '📅 SOLLERS WORK',
  nova: 'Nova tarefa',
  feitas: 'Feitas',
  dados: 'Dados e backup',
};

/** id da tarefa em edição, ou null quando o formulário está criando uma nova. */
let editandoId = null;

/** Cópia em memória usada só quando o navegador não deixa gravar (aba privada, cota cheia). */
let memoria = null;

/* ==================== armazenamento ==================== */

/** @returns {Tarefa[]} */
function carregar() {
  try {
    const raw = memoria !== null ? memoria : localStorage.getItem(STORAGE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(lista)) return [];
    return lista
      .map((item, i) => ({
        id: String(item.id || gerarId()),
        titulo: String(item.titulo || ''),
        data: String(item.data || ''),
        hora: String(item.hora || ''),
        obs: String(item.obs || ''),
        feita: Boolean(item.feita),
        criadoEm: Number(item.criadoEm) || i,
      }))
      .filter((item) => item.data !== '' && item.titulo !== '');
  } catch {
    return [];
  }
}

/** @param {Tarefa[]} lista */
function salvar(lista) {
  const json = JSON.stringify(lista);
  try {
    localStorage.setItem(STORAGE_KEY, json);
    memoria = null;
  } catch {
    // sem armazenamento os dados valem só até fechar a aba, então avisa
    memoria = json;
    mostrarToast('Este navegador não deixou salvar. Exporte um CSV!');
  }
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ==================== datas ==================== */

/** Date local -> "AAAA-MM-DD" (toISOString usaria UTC e erraria o dia à noite). */
function paraISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** "AAAA-MM-DD" -> Date ao meio-dia local, para não pular dia no horário de verão. */
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

function formatoData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** "2026-10-09" -> "sex, 09/10" (com o ano só quando não é o ano atual) */
function dataCurta(iso) {
  const d = deISO(iso);
  const [ano, mes, dia] = iso.split('-');
  const sufixoAno = ano === hojeISO().slice(0, 4) ? '' : `/${ano}`;
  return `${DIAS_CURTOS[d.getDay()]}, ${dia}/${mes}${sufixoAno}`;
}

/** Nome grande do dia: Hoje, Amanhã ou o dia da semana. */
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
  return '';
}

/* ==================== regras da agenda ==================== */

/** Dentro do dia: primeiro as sem horário, depois por horário, depois pela ordem de criação. */
function ordenarNoDia(a, b) {
  if (a.data !== b.data) return a.data.localeCompare(b.data);
  if (a.hora !== b.hora) return a.hora.localeCompare(b.hora);
  return a.criadoEm - b.criadoEm;
}

function agruparPorDia(lista) {
  const grupos = new Map();
  for (const t of lista) {
    if (!grupos.has(t.data)) grupos.set(t.data, []);
    grupos.get(t.data).push(t);
  }
  return grupos;
}

/** Atrasadas = dias passados com algo pendente. Feitas antigas vão para a tela Feitas. */
function separar(lista) {
  const hoje = hojeISO();
  const ordenada = [...lista].sort(ordenarNoDia);
  return {
    atrasadas: ordenada.filter((t) => t.data < hoje && !t.feita),
    futuras: ordenada.filter((t) => t.data >= hoje),
    feitasAntigas: ordenada.filter((t) => t.data < hoje && t.feita),
  };
}

function plural(n, singular, varias) {
  return `${n} ${n === 1 ? singular : varias}`;
}

/* ==================== navegação ==================== */

function irPara(view) {
  if (view !== 'nova' && editandoId) sairDaEdicao();

  document.querySelectorAll('.view').forEach((secao) => {
    secao.classList.toggle('ativa', secao.id === `view-${view}`);
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('ativa', tab.dataset.ir === view);
  });

  document.getElementById('titulo-view').textContent = TITULOS[view] || TITULOS.agenda;
  window.scrollTo(0, 0);

  if (view === 'nova' && !editandoId) document.getElementById('titulo').focus();
}

/* ==================== montagem da tela ==================== */

/** @param {Tarefa} t @param {{mostrarData?: boolean}} opcoes */
function criarItem(t, opcoes = {}) {
  const li = document.createElement('li');
  li.className = 'item' + (t.feita ? ' feita' : '');

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'check';
  check.textContent = t.feita ? '✓' : '';
  check.setAttribute('aria-label', t.feita ? 'Marcar como não feita' : 'Marcar como feita');
  check.addEventListener('click', () => alternarFeita(t));

  const hora = document.createElement('span');
  hora.className = 'item-hora' + (t.hora ? '' : ' sem-hora');
  hora.textContent = t.hora || 'dia todo';

  const info = document.createElement('button');
  info.type = 'button';
  info.className = 'item-info';
  info.addEventListener('click', () => editar(t));

  const titulo = document.createElement('span');
  titulo.className = 'item-titulo';
  titulo.textContent = t.titulo;
  info.appendChild(titulo);

  const partesSub = [];
  if (opcoes.mostrarData) {
    const quando = diasEntre(hojeISO(), t.data) === -1 ? 'ontem' : distancia(t.data);
    partesSub.push(`${dataCurta(t.data)} · ${quando}`);
  }
  if (t.obs) partesSub.push(t.obs);
  if (partesSub.length > 0) {
    const sub = document.createElement('span');
    sub.className = 'item-sub';
    sub.textContent = partesSub.join(' — ');
    info.appendChild(sub);
  }

  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'item-delete';
  btnDelete.textContent = '×';
  btnDelete.setAttribute('aria-label', 'Excluir tarefa');
  btnDelete.addEventListener('click', () => pedirExclusao(btnDelete, t));

  li.append(check, hora, info, btnDelete);
  return li;
}

function criarDia({ nome, data, classe, tarefas, mostrarData }) {
  const bloco = document.createElement('section');
  bloco.className = 'dia' + (classe ? ` ${classe}` : '');

  const topo = document.createElement('div');
  topo.className = 'dia-topo';

  const elNome = document.createElement('span');
  elNome.className = 'dia-nome';
  elNome.textContent = nome;

  const elData = document.createElement('span');
  elData.className = 'dia-data';
  elData.textContent = data;

  topo.append(elNome, elData);

  const ul = document.createElement('ul');
  ul.className = 'lista';
  for (const t of tarefas) ul.appendChild(criarItem(t, { mostrarData }));

  bloco.append(topo, ul);
  return bloco;
}

function renderAgenda(lista) {
  const { atrasadas, futuras } = separar(lista);
  const container = document.getElementById('lista-dias');
  container.innerHTML = '';

  if (atrasadas.length > 0) {
    container.appendChild(criarDia({
      nome: '⚠ Atrasadas',
      data: plural(atrasadas.length, 'pendente', 'pendentes'),
      classe: 'dia-atrasadas',
      tarefas: atrasadas,
      mostrarData: true,
    }));
  }

  // só aparecem os dias que têm alguma coisa marcada
  const hoje = hojeISO();
  for (const [data, tarefas] of agruparPorDia(futuras)) {
    const dist = distancia(data);
    container.appendChild(criarDia({
      nome: nomeDoDia(data),
      data: dataCurta(data) + (dist ? ` · ${dist}` : ''),
      classe: data === hoje ? 'dia-hoje' : '',
      tarefas,
    }));
  }

  document.getElementById('agenda-vazia').hidden = atrasadas.length + futuras.length > 0;

  const pendHoje = futuras.filter((t) => t.data === hoje && !t.feita).length;
  const limite = somarDias(hoje, 6);
  const pendSemana = futuras.filter((t) => t.data <= limite && !t.feita).length;

  document.getElementById('stat-hoje').textContent =
    pendHoje === 0 ? 'Livre' : plural(pendHoje, 'tarefa', 'tarefas');
  document.getElementById('stat-semana').textContent =
    pendSemana === 0 ? 'Livre' : plural(pendSemana, 'tarefa', 'tarefas');
}

function renderFeitas(lista) {
  const { feitasAntigas } = separar(lista);
  const container = document.getElementById('lista-feitas');
  container.innerHTML = '';

  // mais recentes primeiro
  const dias = [...agruparPorDia(feitasAntigas)].reverse();
  for (const [data, tarefas] of dias) {
    const dist = distancia(data);
    container.appendChild(criarDia({
      nome: nomeDoDia(data),
      data: dataCurta(data) + (dist ? ` · ${dist}` : ''),
      tarefas,
    }));
  }

  document.getElementById('feitas-vazio').hidden = feitasAntigas.length > 0;
}

function render() {
  const lista = carregar();
  renderAgenda(lista);
  renderFeitas(lista);
}

/* ==================== ações ==================== */

function alternarFeita(tarefa) {
  const lista = carregar();
  const atual = lista.find((t) => t.id === tarefa.id);
  if (!atual) return;
  atual.feita = !atual.feita;
  salvar(lista);
  render();
  mostrarToast(atual.feita ? 'Feito! ✓' : 'Tarefa reaberta.');
}

function editar(tarefa) {
  editandoId = tarefa.id;
  document.getElementById('titulo').value = tarefa.titulo;
  document.getElementById('data').value = tarefa.data;
  document.getElementById('hora').value = tarefa.hora;
  document.getElementById('obs').value = tarefa.obs;
  document.getElementById('titulo-form').textContent = 'Editar tarefa';
  document.getElementById('btn-salvar').textContent = 'Salvar alterações';
  document.getElementById('btn-cancelar-edicao').hidden = false;
  irPara('nova');
  document.getElementById('titulo-view').textContent = 'Editar tarefa';
}

function sairDaEdicao() {
  editandoId = null;
  document.getElementById('titulo-form').textContent = 'Nova tarefa';
  document.getElementById('btn-salvar').textContent = 'Adicionar tarefa';
  document.getElementById('btn-cancelar-edicao').hidden = true;
  limparFormulario();
}

function limparFormulario() {
  document.getElementById('titulo').value = '';
  document.getElementById('data').value = hojeISO();
  document.getElementById('hora').value = '';
  document.getElementById('obs').value = '';
}

/**
 * Primeiro toque no "×" pede confirmação no próprio botão, o segundo exclui.
 * Sem janela do navegador: funciona igual no celular e não apaga por toque errado.
 */
function pedirExclusao(botao, tarefa) {
  if (botao.dataset.confirmando === 'sim') {
    salvar(carregar().filter((t) => t.id !== tarefa.id));
    render();
    mostrarToast('Tarefa excluída.');
    return;
  }

  botao.dataset.confirmando = 'sim';
  botao.textContent = 'Excluir?';
  botao.classList.add('confirmando');

  clearTimeout(Number(botao.dataset.timer));
  botao.dataset.timer = String(setTimeout(() => {
    botao.dataset.confirmando = 'nao';
    botao.textContent = '×';
    botao.classList.remove('confirmando');
  }, 4000));
}

function mostrarToast(mensagem) {
  const toast = document.getElementById('toast');
  toast.textContent = mensagem;
  toast.hidden = false;
  clearTimeout(mostrarToast._t);
  mostrarToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
}

/* ==================== CSV ==================== */

const CABECALHO_CSV = ['Data', 'Horário', 'Tarefa', 'Observação', 'Feita'];

// marca de início de arquivo UTF-8 que o Excel espera para exibir acentos corretamente
const BOM = '﻿';

function campoParaCSV(texto) {
  const s = String(texto == null ? '' : texto);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function gerarCSV(lista) {
  const linhas = [CABECALHO_CSV.join(';')];
  for (const t of [...lista].sort(ordenarNoDia)) {
    linhas.push([formatoData(t.data), t.hora, t.titulo, t.obs, t.feita ? 'Sim' : 'Não']
      .map(campoParaCSV).join(';'));
  }
  return linhas.join('\r\n');
}

function exportarCSV() {
  const lista = carregar();
  if (lista.length === 0) {
    mostrarToast('Nada para exportar ainda.');
    return;
  }
  const blob = new Blob([BOM + gerarCSV(lista)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `agendei-${hojeISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  mostrarToast(`${plural(lista.length, 'tarefa exportada', 'tarefas exportadas')}.`);
}

/** Divide uma linha de CSV respeitando campos entre aspas. */
function dividirLinha(linha, separador) {
  const campos = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === separador) { campos.push(atual); atual = ''; }
    else atual += c;
  }
  campos.push(atual);
  return campos.map((s) => s.trim());
}

/** Junta as linhas físicas que estão dentro de aspas (observação com quebra de linha). */
function linhasLogicas(texto) {
  const linhas = [];
  let acumulada = null;
  for (const linha of texto.split(/\r?\n/)) {
    acumulada = acumulada === null ? linha : `${acumulada}\n${linha}`;
    if ((acumulada.match(/"/g) || []).length % 2 === 0) {
      linhas.push(acumulada);
      acumulada = null;
    }
  }
  if (acumulada !== null) linhas.push(acumulada);
  return linhas.filter((l) => l.trim() !== '');
}

function parseDataParaISO(texto) {
  let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return texto;
  return '';
}

function parseHora(texto) {
  const m = texto.match(/^(\d{1,2})[:h](\d{2})/i);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function chaveTarefa(t) {
  return [t.data, t.hora, t.titulo.toLowerCase(), t.obs.toLowerCase()].join('|');
}

function importarCSV(texto) {
  const linhas = linhasLogicas(texto.replace(/^﻿/, ''));
  const resultado = { total: 0, adicionados: 0, ignorados: 0, invalidos: 0 };
  if (linhas.length === 0) return resultado;

  const separador = linhas[0].includes(';') ? ';' : ',';
  const atual = carregar();
  const existentes = new Set(atual.map(chaveTarefa));

  for (const linha of linhas) {
    const [data, hora = '', titulo = '', obs = '', feita = ''] = dividirLinha(linha, separador);
    if (/^data$/i.test(data)) continue; // cabeçalho

    resultado.total++;
    const iso = parseDataParaISO(data);
    if (!iso || !titulo) {
      resultado.invalidos++;
      continue;
    }

    const tarefa = {
      id: gerarId(),
      titulo,
      data: iso,
      hora: parseHora(hora),
      obs,
      feita: /^(sim|s|x|1|true)$/i.test(feita),
      criadoEm: Date.now() + resultado.total,
    };

    if (existentes.has(chaveTarefa(tarefa))) {
      resultado.ignorados++;
      continue;
    }
    existentes.add(chaveTarefa(tarefa));
    atual.push(tarefa);
    resultado.adicionados++;
  }

  if (resultado.adicionados > 0) {
    salvar(atual);
    render();
  }
  return resultado;
}

function mostrarStatusImportacao(mensagem, tipo) {
  const el = document.getElementById('status-importacao');
  el.textContent = mensagem;
  el.className = `status-importacao ${tipo}`;
  el.hidden = false;
}

/* ==================== início ==================== */

function init() {
  document.getElementById('versao').textContent = VERSAO;
  limparFormulario();

  document.querySelectorAll('[data-ir]').forEach((botao) => {
    botao.addEventListener('click', () => irPara(botao.dataset.ir));
  });

  document.querySelectorAll('[data-dias]').forEach((botao) => {
    botao.addEventListener('click', () => {
      document.getElementById('data').value = somarDias(hojeISO(), Number(botao.dataset.dias));
    });
  });

  document.getElementById('btn-limpar-hora').addEventListener('click', () => {
    document.getElementById('hora').value = '';
  });

  document.getElementById('btn-cancelar-edicao').addEventListener('click', () => {
    sairDaEdicao();
    irPara('agenda');
  });

  document.getElementById('form-tarefa').addEventListener('submit', (ev) => {
    ev.preventDefault();

    const titulo = document.getElementById('titulo').value.trim();
    const data = document.getElementById('data').value;
    const hora = document.getElementById('hora').value;
    const obs = document.getElementById('obs').value.trim();

    if (!titulo || !data) {
      mostrarToast('Preencha o que fazer e o dia.');
      return;
    }

    const atual = carregar();

    if (editandoId) {
      const indice = atual.findIndex((t) => t.id === editandoId);
      if (indice >= 0) atual[indice] = { ...atual[indice], titulo, data, hora, obs };
    } else {
      atual.push({ id: gerarId(), criadoEm: Date.now(), titulo, data, hora, obs, feita: false });
    }

    const eraEdicao = Boolean(editandoId);
    salvar(atual);
    sairDaEdicao();
    render();

    irPara('agenda');
    mostrarToast(eraEdicao ? 'Tarefa atualizada!' : `Marcado para ${nomeDoDia(data).toLowerCase()}!`);
  });

  document.getElementById('btn-exportar').addEventListener('click', exportarCSV);

  const inputArquivo = document.getElementById('input-arquivo');
  document.getElementById('btn-importar').addEventListener('click', () => inputArquivo.click());

  inputArquivo.addEventListener('change', (ev) => {
    const arquivo = ev.target.files && ev.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const r = importarCSV(String(leitor.result));
        if (r.total === 0) {
          mostrarStatusImportacao('Nenhuma tarefa encontrada no arquivo.', 'erro');
        } else {
          const partes = [`${r.adicionados} importada(s)`];
          if (r.ignorados > 0) partes.push(`${r.ignorados} já existia(m)`);
          if (r.invalidos > 0) partes.push(`${r.invalidos} linha(s) inválida(s)`);
          mostrarStatusImportacao(partes.join(' · '), r.adicionados > 0 ? 'ok' : 'erro');
          if (r.adicionados > 0) mostrarToast('Importação concluída!');
        }
      } catch {
        mostrarStatusImportacao('Não foi possível ler o arquivo. Confira se é um CSV.', 'erro');
      }
      ev.target.value = '';
    };
    leitor.onerror = () => {
      mostrarStatusImportacao('Não foi possível ler o arquivo.', 'erro');
      ev.target.value = '';
    };
    leitor.readAsText(arquivo, 'UTF-8');
  });

  document.getElementById('btn-limpar-feitas').addEventListener('click', () => {
    const lista = carregar();
    const { feitasAntigas } = separar(lista);
    if (feitasAntigas.length === 0) {
      mostrarToast('Não há concluídas antigas.');
      return;
    }
    const ok = confirm(`Remover ${plural(feitasAntigas.length, 'tarefa concluída', 'tarefas concluídas')} de dias que já passaram?`);
    if (!ok) return;
    const remover = new Set(feitasAntigas.map((t) => t.id));
    salvar(lista.filter((t) => !remover.has(t.id)));
    render();
    mostrarToast('Concluídas antigas removidas.');
  });

  document.getElementById('btn-apagar-tudo').addEventListener('click', () => {
    const total = carregar().length;
    if (total === 0) {
      mostrarToast('Não há tarefas para apagar.');
      return;
    }
    const ok = confirm(`Apagar todas as ${total} tarefas deste aparelho?\n\nIsso não pode ser desfeito.`);
    if (!ok) return;

    memoria = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* nada salvo para remover */ }
    render();
    mostrarToast('Todas as tarefas foram apagadas.');
  });

  // virou o dia com o app aberto: "Amanhã" passa a ser "Hoje" ao voltar para ele
  let diaRenderizado = hojeISO();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && hojeISO() !== diaRenderizado) {
      diaRenderizado = hojeISO();
      render();
    }
  });

  render();
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
