"""
Reads deploy log from a file, posts it to Telegraph, prints the page URL.
Usage: python3 post_telegraph.py <log_file>
Env:   TELEGRAPH_TOKEN, DEPLOY_TITLE
"""
import json
import os
import sys
import urllib.request

token = os.environ.get("TELEGRAPH_TOKEN",'b05d4b6aadddfa0bc73fddcf6b305881e4c7fcc57ef95b11e9f7d392143d')
title = os.environ.get("DEPLOY_TITLE", "Deploy Error")

log_file = sys.argv[1] if len(sys.argv) > 1 else None
if log_file and os.path.exists(log_file):
    with open(log_file, "r", errors="replace") as f:
        log = f.read()
else:
    log = "Log topilmadi"

nodes = []
for line in log.splitlines():
    line = line.strip()
    if line:
        nodes.append({"tag": "p", "children": [line[:512]]})
if not nodes:
    nodes = [{"tag": "p", "children": ["Log topilmadi"]}]

payload = json.dumps({
    "access_token": token,
    "title": title,
    "content": nodes,
    "return_content": False,
}).encode("utf-8")

try:
    req = urllib.request.Request(
        "https://api.telegra.ph/createPage",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
    print(f"Telegraph raw response: {raw.decode()}", file=sys.stderr)
    data = json.loads(raw)
    if data.get("ok"):
        print(data["result"]["url"])
    else:
        print(f"Telegraph API error: {data}", file=sys.stderr)
        print("https://telegra.ph")
except Exception as e:
    print(f"Exception: {type(e).__name__}: {e}", file=sys.stderr)
    print("https://telegra.ph")
