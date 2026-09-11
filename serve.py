#!/usr/bin/env python3
"""Tiny static dev server for the questionnaire. Standard library only.

    python3 serve.py              # http://localhost:8080
    python3 serve.py 3000         # pick a port
    python3 serve.py --no-cache=0 # allow browser caching (off by default)

Serves this directory. Nothing is written, nothing is uploaded — it exists so the
page can be opened over http:// instead of file:// (handy for devtools, for
fetching data.json directly, and for testing on a phone on the same network).
"""
import argparse
import http.server
import os
import socket
import socketserver
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    no_cache = True

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        if self.no_cache:
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


class Server(socketserver.TCPServer):
    allow_reuse_address = True


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


def main():
    p = argparse.ArgumentParser(description="Static dev server for the taxonomy questionnaire.")
    p.add_argument("port", nargs="?", type=int, default=8080, help="port to listen on (default 8080)")
    p.add_argument("--host", default="0.0.0.0", help="interface to bind (default 0.0.0.0)")
    p.add_argument("--no-cache", type=int, default=1, help="send no-store cache headers (default 1)")
    args = p.parse_args()

    Handler.no_cache = bool(args.no_cache)

    port = args.port
    for attempt in range(20):
        try:
            httpd = Server((args.host, port), Handler)
            break
        except OSError:
            print("port %d is busy, trying %d" % (port, port + 1))
            port += 1
    else:
        sys.exit("could not find a free port near %d" % args.port)

    print("Serving %s" % ROOT)
    print("  http://localhost:%d/" % port)
    ip = lan_ip()
    if ip and args.host == "0.0.0.0":
        print("  http://%s:%d/   (same network, e.g. a phone)" % (ip, port))
    print("Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
        httpd.server_close()


if __name__ == "__main__":
    main()
