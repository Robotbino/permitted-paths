"""single-file.py: write the whole course as one HTML file, with no other files.

The stylesheets, the scripts and the fonts go inside the file. Use it to send the
course to a phone (WhatsApp, Mail, Files): such a viewer cannot load the other files.
The site itself does not use this file and has no build step.

    python tools/single-file.py [output]      (default: dist/permitted-paths.html)
"""
import base64, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()

def css(path):
    text = read(path)
    base = os.path.dirname(path)
    def font(m):
        ref = m.group(2)
        if ref.startswith(('data:', '#', 'http')):
            return m.group(0)
        with open(os.path.normpath(os.path.join(ROOT, base, ref)), 'rb') as f:
            data = base64.b64encode(f.read()).decode('ascii')
        kind = 'font/woff2' if ref.endswith('.woff2') else 'application/octet-stream'
        return 'url("data:%s;base64,%s")' % (kind, data)
    return re.sub(r'url\((["\']?)([^)"\']+)\1\)', font, text)

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'permitted-paths.html')
    html = read('index.html')
    html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>',
                  lambda m: '<style>\n' + css(m.group(1)) + '\n</style>', html)
    html = re.sub(r'<script[^>]*src="([^"]+)"[^>]*>\s*</script>',
                  lambda m: '<script>\n' + read(m.group(1)).replace('</script', '<\\/script') + '\n</script>', html)
    left = re.findall(r'(?:src|href)="(?!#|https?:|data:|mailto:)([^"]+)"', html)
    if left:
        sys.exit('These files are not inside the output: ' + ', '.join(sorted(set(left))))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('Wrote %s (%d KB)' % (os.path.relpath(out), len(html.encode('utf-8')) // 1024))

if __name__ == '__main__':
    main()
