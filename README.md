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

## Guarnições e suprimento

Em **Estados e províncias**, selecione um destino e abra **Administrar forças**. Cada província possui guarnição própria, com unidades do Exército, da Força Aérea e da Marinha. Escolha a origem, o tipo e a quantidade. O envio desconta unidades na partida e resolve o reforço ou o combate no turno de chegada. Bases navais usam uma lista de portos e corredores selecionados.

As ligações terrestres domésticas são calculadas pela vizinhança das subdivisões do Natural Earth, com percurso entre pontos de comando. O traçado é uma rede de jogo. Os efetivos são unidades de jogo calculadas a partir do índice nacional de força. A disponibilidade inicial de corvetas e submarinos no Brasil usa como referência a lista pública de [meios da Esquadra da Marinha do Brasil](https://www.marinha.mil.br/forsup/meios-navais). Sua distribuição provincial é simulada.

## Comércio, orçamento e jornal mundial

O mapa reúne fronteiras, províncias, capitais, áreas minerais, conflitos e rotas comerciais. **Traçar rota** seleciona duas capitais para despachar tropas ou lotes de suprimento. O painel de comércio ativa corredores marítimos cadastrados, impõe embargos e fecha ou reabre travessias civis modeladas. Guerra e embargo suspendem as receitas comerciais bilaterais.

O orçamento distribui 100% entre defesa, educação, saúde, políticas públicas e ciência e tecnologia. Os indicadores e as notícias do jornal são simulados. Guerras disparam deslocamentos para corredores disponíveis. O mapa de corredores é parcial.

## Pacífico e ilhas

O mapa se repete horizontalmente ao cruzar o meridiano de 180° e aproxima até 120×. O botão **Pacífico** centra a região. A lista **Ilhas do Pacífico** localiza territórios e atóis mesmo quando o contorno é pequeno. O catálogo combina unidades administrativas do [Natural Earth 1:10 milhões](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/) com pontos insulares selecionados. Uma expedição usa a reserva nacional e resolve a ocupação ao chegar, durante guerra com o controlador indicado. O traçado e o tempo da expedição são aproximações de jogo.

## Logística e arrecadação

O planejador compara trajetos terrestres, embarque marítimo e transporte aéreo. A rota marítima usa uma rede de 47 portos e 143 conexões derivadas do [SeaRoute](https://eurostat.github.io/searoute/) via searoute-py 1.6.0. A licença acompanha os dados. As escalas aéreas usam 168 aeroportos do [OurAirports](https://ourairports.com/data/) e um alcance simulado de 5.600 km. O trecho Rio de Janeiro–Belo Horizonte usa dados © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) calculados pelo OSRM. Os outros acessos terrestres usam corredores estimados. Distâncias, transbordo e peso da carga entram no prazo e no custo.

A economia usa a última taxa de [receita tributária em relação ao PIB do Banco Mundial](https://data.worldbank.org/indicator/GC.TAX.TOTL.GD.ZS) disponível desde 2015 para 149 economias. As demais usam uma estimativa de 18%. Cada turno contabiliza sete dias de receita, e a parcela destinada à defesa financia o caixa de operações.
