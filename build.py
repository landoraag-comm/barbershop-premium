import pathlib, shutil
src=pathlib.Path('src'); out=pathlib.Path('public'); out.mkdir(exist_ok=True)
body=(src/'body.html').read_text()
head='''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Barber — Experience</title>
<meta name="description" content="Barbearia premium: corte masculino, barba clássica e agendamento online. Precisão em cada detalhe, tradição em cada gesto.">
<meta name="theme-color" content="#080808">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%23080808%22/%3E%3Ctext x=%2216%22 y=%2222%22 font-size=%2218%22 text-anchor=%22middle%22 fill=%22%23c48a5f%22 font-family=%22Georgia%22 font-style=%22italic%22%3EB%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Instrument+Serif:ital@0;1&family=Manrope:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js" defer></script>
<script type="module" src="app.js"></script>
</head>
<body>
'''
(out/'index.html').write_text(head+body+'\n</body>\n</html>\n')
for f in ['styles.css','app.js','data.js','stage.js','models.js','admin.js','firebase-store.js','firebase-config.js']:
    (out/f).write_text((src/f).read_text())
print('ok')

shutil.copytree(src/'img', out/'img', dirs_exist_ok=True)
print('img ok')
