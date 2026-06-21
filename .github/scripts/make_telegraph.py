import sys
import json

log = sys.stdin.read()
nodes = []
for line in log.splitlines():
    line = line.strip()
    if line:
        nodes.append({"tag": "p", "children": [line[:512]]})
if not nodes:
    nodes = [{"tag": "p", "children": ["Log topilmadi"]}]
print(json.dumps(nodes))
