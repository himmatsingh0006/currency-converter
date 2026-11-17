import json
import re
import threading
import time
import  webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import parse_qs, urlparse


APP_DIR = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000
RATE_CACHE_SECONDS = 600
rate_cache = {}
cache_lock = threading.Lock()


class CurrencyHandler(BaseHTTPRequestHandler):
    def send_bytes(self, status, content, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, status, data):
        content = json.dumps(data).encode("utf-8")
        self.send_bytes(status, content, "application/json; charset=utf-8")

    def do_GET(self):
        path = urlparse(self.path)

        if path.path == "/api/rates":
            self.handle_rates(parse_qs(path.query))
            return

        pages = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
        }
        page = pages.get(path.path)
        if page is None:
            self.send_json(404, {"error": "Page not found."})
            return

        filename, content_type = page
        content = (APP_DIR / filename).read_bytes()
        self.send_bytes(200, content, content_type)

    def handle_rates(self, query):
        base_values = query.get("base", ["USD"])
        base = base_values[0].upper()
        if not re.fullmatch(r"[A-Z]{3}", base):
            self.send_json(400, {"error": "Enter a valid three-letter currency code."})
            return

        now = time.time()
        with cache_lock:
            cached = rate_cache.get(base)
            if not query.get("refresh") and cached and now - cached["cached_at"] < RATE_CACHE_SECONDS:
                self.send_json(200, cached["data"])
                return

        request = Request(
            "https://open.er-api.com/v6/latest/" + base,
            headers={"User-Agent": "CurrencyConverter/1.0"},
        )
        try:
            with urlopen(request, timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            self.send_json(502, {"error": "Could not load live exchange rates. Check your internet connection and try again."})
            return

        rates = payload.get("rates")
        if payload.get("result") != "success" or not isinstance(rates, dict):
            self.send_json(502, {"error": "The exchange-rate service returned an unexpected response."})
            return

        data = {
            "base": base,
            "rates": rates,
            "updated": payload.get("time_last_update_utc"),
        }
        with cache_lock:
            rate_cache[base] = {"cached_at": time.time(), "data": data}
        self.send_json(200, data)

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args))


if __name__ == "__main__":
    address = "http://%s:%s" % (HOST, PORT)
    server = ThreadingHTTPServer((HOST, PORT), CurrencyHandler)
    print("Currency Converter is running at " + address)
    print("Press Ctrl+C to stop the server.")
    webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Currency Converter.")
    finally:
        server.server_close()
