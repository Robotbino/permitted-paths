# sync-page.py: put the current text of each file in lab/ into its copy in index.html.
#
# Part L shows the files of lab/ on the page. A page that opens from file:// cannot read them,
# so index.html has a copy of each one. After you change a file in lab/, run:
#
#     python lab/tools/sync-page.py
#
# It replaces the text of each block that has data-file="lab/..." and changes nothing else.
# Run it again and it reports 0 changes.
import html, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
page = os.path.join(ROOT, 'index.html')
text = io.open(page, encoding='utf8').read()
changed = []

def put(match):
    name = match.group(2)
    path = os.path.join(ROOT, *name.split('/'))
    if not os.path.isfile(path):
        sys.exit('The page names a file that does not exist: ' + name)
    body = html.escape(io.open(path, encoding='utf8').read().rstrip('\n'), quote=False)
    if body != match.group(4):
        changed.append(name)
    return match.group(1) + name + match.group(3) + body + match.group(5)

pattern = re.compile(r'(<div class="pcode" data-lab="copy" data-keep data-file=")(lab/[^"]+)(">\s*<pre><code>)(.*?)(</code></pre>)', re.S)
new = pattern.sub(put, text)
blocks = len(pattern.findall(text))
if new != text:
    io.open(page, 'w', encoding='utf8', newline='\n').write(new)
print('%d blocks, %d changed%s' % (blocks, len(changed), (': ' + ', '.join(changed)) if changed else ''))
