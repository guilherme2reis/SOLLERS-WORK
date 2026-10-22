# SOLLERS WORK

Agenda simples em forma de lista de tarefas: página única,
funciona no celular, instalável na tela de início e sem servidor — os dados ficam salvos no
próprio aparelho (`localStorage`).

A diferença para uma agenda comum: **só aparecem os dias que têm alguma coisa marcada.**
Dia vazio não ocupa espaço na tela.

## Telas

| Tela | O que faz |
| --- | --- |
| **Agenda** | Tarefas pendentes de hoje e dos próximos 7 dias; bloco **⚠ Atrasadas** (dias que passaram com algo por fazer); depois um bloco por dia que tem tarefa — *Hoje*, *Amanhã*, *Quarta · qua, 14/10 · em 5 dias*… |
| **Nova** | O que fazer, dia (com atalhos *Hoje*, *Amanhã*, *Daqui 1 semana*), horário opcional e observação opcional |
| **Feitas** | Tarefas concluídas de dias que já passaram, das mais recentes para as mais antigas |
| **Dados** | Exportar CSV, importar CSV, limpar concluídas antigas e apagar tudo |

Dentro de cada dia, as tarefas sem horário (*dia todo*) vêm primeiro e as outras seguem a ordem do horário.

- **Marcar como feita:** toque no círculo. Ela fica riscada com ✓ e continua no dia; quando o dia
  passa, vai para a tela *Feitas*. Tocar de novo no ✓ reabre a tarefa.
- **Editar:** toque no texto da tarefa.
- **Excluir:** toque no `×`: ele vira "Excluir?" e o segundo toque confirma.

Cores: azul para o normal e para o que está feito, laranja para atrasadas e exclusão — nada
depende de diferenciar verde e vermelho, e sempre há um símbolo junto (✓, ⚠).

## Backup (exportar e importar)

Os dados ficam **só neste aparelho**. Exporte um CSV de tempos em tempos.

**Exportar** gera `sollers-work-AAAA-MM-DD.csv` com as colunas
`Data;Horário;Tarefa;Observação;Feita`, que abre direto no Excel.

**Importar** aceita esse mesmo formato (datas `09/10/2026` ou `2026-10-09`, horário `14:30` ou
`14h30`, *Feita* = `Sim`/`Não`). Tarefas idênticas às que já estão no app são ignoradas.

Dá para montar uma lista de compromissos no Excel com essas colunas, salvar como CSV e importar
tudo de uma vez.

## Publicar no GitHub Pages

1. Crie um repositório novo (`SOLLERS-WORK`).
2. Envie `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `icon-192.png` e
   `icon-512.png` para a raiz.
3. Em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`.
4. O app fica em `https://guilherme2reis.github.io/SOLLERS-WORK/`.

No celular, abra o endereço e use **Adicionar à tela de início**.

## Ao publicar uma alteração

Sempre que alterar `index.html`, `style.css` ou `app.js`, suba o número em **duas linhas**,
senão o celular continua com a versão antiga guardada para uso offline:

- `const CACHE = `${PREFIXO}1.2.0`;` em `sw.js`
- `const VERSAO = '1.2.0';` em `app.js`

## No computador (atalho da Área de Trabalho)

O atalho **SOLLERS WORK** roda `iniciar.pyw` (Python, sem janela preta). Ele liga um
servidor que só este computador enxerga (`127.0.0.1:8731`) e abre o app numa janela do Chrome.

No computador as tarefas ficam gravadas em **`dados.json`**, nesta pasta, e não na memória
do navegador. Por isso não importa em qual perfil do Chrome a janela abre, nem se os dados
do navegador forem limpos. Toda gravação também deixa uma cópia do dia em `backups/`
(as dos últimos 60 dias).

`dados.json` e `backups/` estão no `.gitignore`: são seus dados e não vão para o GitHub.

Se aparecer o aviso "⚠ Não gravou no arquivo", feche a janela e abra pelo atalho de novo.

## Rodar no computador (para mexer no código)

```bash
python -m http.server 8125
```

E abra `http://localhost:8125`.
