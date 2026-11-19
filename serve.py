#!/usr/bin/env python3
"""
散布図作成ツール (QuickScatter) - ローカル確認用 HTTP サーバ起動スクリプト
- 外部ライブラリ不要（Python 3 標準ライブラリのみで動作）
- 開発・確認時のキャッシュによる更新不反映を防ぐため Cache-Control: no-cache を付与
- 利用可能なポートを自動検出（デフォルト: 8000）
- ブラウザを自動オープン
"""

import sys
import os
import socket
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

DEFAULT_PORT = 8000
MAX_PORT_ATTEMPTS = 20

class NoCacheHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # 開発・確認時にJSやCSSがキャッシュされるのを防ぐヘッダー
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # セキュリティ強化ヘッダー
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {args[0]} {args[1]}\n")

def find_available_port(start_port=DEFAULT_PORT):
    for port in range(start_port, start_port + MAX_PORT_ATTEMPTS):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

def run():
    root_dir = Path(__file__).resolve().parent
    os.chdir(root_dir)

    port = find_available_port(DEFAULT_PORT)
    server_address = ('127.0.0.1', port)
    
    httpd = HTTPServer(server_address, NoCacheHTTPRequestHandler)
    url = f"http://localhost:{port}/index.html"
    
    print("=" * 60)
    print("  🚀 散布図作成ツール (QuickScatter) - ローカルサーバ")
    print("=" * 60)
    print(f"  URL: {url}")
    print(f"  公開ディレクトリ: {root_dir}")
    print("  ※ 閉じたネットワーク環境で安全に動作（外部通信ゼロ）")
    print("  終了するには Ctrl + C を押してください")
    print("=" * 60)

    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nサーバを停止しました。")
        httpd.server_close()
        sys.exit(0)

if __name__ == '__main__':
    run()
