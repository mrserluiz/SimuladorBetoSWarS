# Meridiano

Primeira versão jogável do SimuladorBetoSWarS. Campanha geopolítica individual por turnos semanais, com 204 territórios no atlas e 241 localidades do Natural Earth.

## Executar

Use Node.js 22 ou superior.

```bash
node server.mjs
```

Abra http://127.0.0.1:8080, assuma uma nação e selecione outro território. A campanha é salva no navegador. A pasta `dist` pode ser servida diretamente por uma hospedagem estática.

## Diplomacia com GPT

O servidor local detecta `OPENAI_API_KEY` no ambiente. Com essa variável configurada antes da inicialização, o chat usa a Responses API para interpretar o governo fictício do país. É possível definir `OPENAI_MODEL` para selecionar outro modelo. A chave fica no servidor. O motor resolve acordos, cessar-fogo, relação e combate. O GPT redige a fala diplomática de acordo com a decisão do motor. Sem a chave, o jogo responde pelas regras locais.

## Simulação e fontes

- [FMI, World Economic Outlook](https://data.imf.org/Datasets/WEO). PIB nominal de 2025 em bilhões de dólares na edição de outubro de 2026.
- [SIPRI, gasto militar 2025](https://www.sipri.org/publications/2026/sipri-fact-sheets/trends-world-military-expenditure-2025). O cenário incorpora os 40 países da tabela. Para os demais, estima 1,7% do PIB com piso de US$ 0,01 bi. Quando falta PIB, a interface indica a ausência do dado.
- [Natural Earth](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/). Fronteiras e localidades em escala 1:110 milhões. A malha terrestre e marítima tem corredores selecionados, com rotas aéreas aproximadas entre cidades. O jogo usa distância em segmentos e velocidade por modalidade.
- As forças são unidades abstratas calculadas a partir do gasto militar e do PIB. A conquista de uma capital encerra a guerra com o governo correspondente. O cenário começa em paz e pode divergir da geopolítica real.

## Estados, províncias e minerais

Ative **Províncias** no mapa e escolha um país e uma subdivisão. Em guerra, uma vitória no objetivo regional ocupa o território e transfere as áreas minerais cadastradas. A receita mineral entra a partir do turno seguinte. A captura da capital nacional ainda é uma operação separada.

O atlas administrativo usa o Natural Earth 1:10 milhões. Quando a fonte não identifica uma capital local, o mapa usa um ponto regional e sinaliza a ausência. As áreas minerais são uma seleção documentada em `data/mineral-sites.json` e suas receitas são valores de jogo.

Para regenerar o atlas, rode `python data/build-regions.py CAMINHO_ADMIN1.geojson CAMINHO_POPULATED_PLACES.geojson` com as duas camadas 1:10 milhões do Natural Earth.
