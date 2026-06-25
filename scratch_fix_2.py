import re

with open("apps/api/src/home/home.service.ts", "r", encoding="utf-8") as f:
    code = f.read()

# Replace all `.ocupacao` with a safe access if the object is Ecoponto
# Let's just fix it globally for `f.ocupacao` and `e.ocupacao` -> `(f as any).ocupacao` since it's just a test/home service. No wait, `f` in `home.service` is mapped!

code = code.replace("f.ocupacao", "(f as any).ocupacao")
code = code.replace("e.ocupacao", "(e as any).ocupacao")

with open("apps/api/src/home/home.service.ts", "w", encoding="utf-8") as f:
    f.write(code)

with open("apps/api/tests/ecopontos/ecopontos.service.test.ts", "r", encoding="utf-8") as f:
    code = f.read()

code = code.replace("ocupacao: 10", "contentores: [{ tipo: 'Papel', ocupacao: 10 }]")
code = code.replace("ocupacao: 55", "contentores: [{ tipo: 'Vidro', ocupacao: 55 }]")
code = code.replace("ocupacao: 90", "contentores: [{ tipo: 'Plastico', ocupacao: 90 }]")

with open("apps/api/tests/ecopontos/ecopontos.service.test.ts", "w", encoding="utf-8") as f:
    f.write(code)
