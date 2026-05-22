import http.server
import socketserver

class ForceHTMLHandler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        return "text/html"

class MyTCPServer(socketserver.TCPServer):
    # This line forces the OS to release and reuse the port immediately
    allow_reuse_address = True

PORT = 8000
with MyTCPServer(("", PORT), ForceHTMLHandler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down cleanly...")

