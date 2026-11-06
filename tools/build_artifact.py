"""Write the Claude artefact version of index.html.

Artefacts add their own <html>, <head> and <body>, so only the marked parts of
index.html are kept. Usage: python3 tools/build_artifact.py output.html
"""
import re
import sys

page = open("index.html", encoding="utf-8").read()
parts = [re.search(rf"<!-- page-{name}-start -->(.*?)<!-- page-{name}-end -->", page, re.S).group(1)
         for name in ("head", "body")]
open(sys.argv[1], "w", encoding="utf-8").write("".join(parts))
