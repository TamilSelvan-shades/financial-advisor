import re

with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace `@app.post("/api/v1/<endpoint>/", ...)` with `@app.post("/api/v1/<endpoint>", ...)`
# Only for POST endpoints that end with /
new_content = re.sub(r'@app\.post\("(/api/v1/[a-zA-Z0-9_-]+)/"', r'@app.post("\1"', content)

with open("main.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Replaced trailing slashes in POST endpoints.")
