"""SOLLERS WORK no computador: dois cliques no atalho da Área de Trabalho.

Liga um servidor só para este computador (127.0.0.1) que serve o app e grava as
tarefas em dados.json, nesta pasta. Assim elas não dependem da memória do Chrome,
que muda de perfil para perfil e some quando o navegador é limpo.

Se o servidor já estiver ligado (segundo clique no atalho), só abre a janela.
Com --painel abre o painel de tela cheia (painel.html) em vez do app compacto.
Usa apenas a biblioteca padrão do Python.
"""

import json
import os
import shutil
import subprocess
import sys
import threading
import urllib.request
import webbrowser
from datetime import date
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORTA = 8731
PASTA = Path(__file__).resolve().parent
ARQUIVO = PASTA / 'dados.json'
PASTA_BACKUPS = PASTA / 'backups'
DIAS_DE_BACKUP = 60
ENDERECO = f'http://127.0.0.1:{PORTA}/'

CHROMES = [
    Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'Google/Chrome/Application/chrome.exe',
    Path(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')) / 'Google/Chrome/Application/chrome.exe',
    Path(os.environ.get('LOCALAPPDATA', '')) / 'Google/Chrome/Application/chrome.exe',
    Path(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe',
]

trava = threading.Lock()


def ler_tarefas():
    if not ARQUIVO.exists():
        return False, []
    with ARQUIVO.open(encoding='utf-8') as f:
        return True, json.load(f)


def gravar_tarefas(tarefas):
    with trava:
        # grava num arquivo temporário e troca de uma vez: se o PC desligar no
        # meio, fica o arquivo anterior inteiro, nunca um pela metade
        temporario = ARQUIVO.with_suffix('.tmp')
        with temporario.open('w', encoding='utf-8') as f:
            json.dump(tarefas, f, ensure_ascii=False, indent=1)
        os.replace(temporario, ARQUIVO)

        # uma cópia por dia, guardando as dos últimos DIAS_DE_BACKUP dias
        PASTA_BACKUPS.mkdir(exist_ok=True)
        shutil.copyfile(ARQUIVO, PASTA_BACKUPS / f'tarefas-{date.today().isoformat()}.json')
        for antigo in sorted(PASTA_BACKUPS.glob('tarefas-*.json'))[:-DIAS_DE_BACKUP]:
            antigo.unlink()


class Servidor(SimpleHTTPRequestHandler):
    def responder_json(self, status, corpo):
        dados = json.dumps(corpo, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Sollers-Work', '1')
        self.send_header('Content-Length', str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        caminho = self.path.split('?')[0]
        if caminho == '/api/tarefas':
            try:
                existe, tarefas = ler_tarefas()
            except (OSError, ValueError) as erro:
                self.responder_json(500, {'erro': str(erro)})
                return
            self.responder_json(200, {'existe': existe, 'tarefas': tarefas})
            return
        if caminho == '/api/ping':
            self.responder_json(200, {'app': 'sollers-work'})
            return
        if caminho.startswith(('/dados.json', '/backups', '/iniciar')):
            self.send_error(404)
            return
        super().do_GET()

    def do_PUT(self):
        if self.path.split('?')[0] != '/api/tarefas':
            self.send_error(404)
            return
        try:
            tamanho = int(self.headers.get('Content-Length', 0))
            tarefas = json.loads(self.rfile.read(tamanho).decode('utf-8'))
            if not isinstance(tarefas, list):
                raise ValueError('esperava uma lista de tarefas')
            gravar_tarefas(tarefas)
        except (OSError, ValueError) as erro:
            self.responder_json(400, {'erro': str(erro)})
            return
        self.responder_json(200, {'ok': True, 'total': len(tarefas)})

    def end_headers(self):
        # sempre a versão mais nova dos arquivos do app
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *args):
        pass  # sem janela de console, não há onde mostrar


def ja_esta_ligado():
    try:
        with urllib.request.urlopen(ENDERECO + 'api/ping', timeout=1) as r:
            return json.load(r).get('app') == 'sollers-work'
    except (OSError, ValueError):
        return False


def abrir_janela():
    if '--painel' in sys.argv:
        endereco, tamanho = ENDERECO + 'painel.html', '--start-maximized'
    else:
        endereco, tamanho = ENDERECO, '--window-size=460,860'
    for chrome in CHROMES:
        if chrome.exists():
            subprocess.Popen([str(chrome), f'--app={endereco}', tamanho])
            return
    webbrowser.open(endereco)


def main():
    if ja_esta_ligado():
        abrir_janela()
        return

    servidor = ThreadingHTTPServer(('127.0.0.1', PORTA), partial(Servidor, directory=str(PASTA)))
    threading.Timer(0.3, abrir_janela).start()
    servidor.serve_forever()


if __name__ == '__main__':
    sys.exit(main())
