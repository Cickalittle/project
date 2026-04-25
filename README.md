# Progetto Informatica — Cristian Agostini

> Studio di funzione, cifratore Enigma e analisi lessicale, in un'unica web app Flask.

Un progetto scolastico che unisce tre moduli interattivi — uno per materia — costruiti con Python/Flask sul backend e HTML/CSS/JS vanilla sul frontend.

---

## Struttura del progetto

```
project/
├── app.py                  # Server Flask, API REST, logica Enigma
├── requirements.txt
├── data/
│   └── elements.json
├── templates/
│   ├── index.html
│   ├── matematica.html
│   ├── italiano.html
│   ├── storia.html
│   └── coming_soon.html
└── static/
    ├── css/
    │   ├── base.css
    │   ├── index.css
    │   ├── matematica.css
    │   ├── italiano.css
    │   ├── storia.css
    │   └── coming_soon.css
    └── js/
        ├── theme.js
        ├── matematica.js
        ├── italiano.js
        └── storia.js
```

---

## Moduli

### 01 · Matematica — Studio di Funzione

Analisi completa di una funzione reale, calcolata simbolicamente con **SymPy**.

- **Dominio** — calcolato tramite `continuous_domain`
- **Derivate** — prima e seconda derivata simbolica, resa in LaTeX via MathJax
- **Punti critici** — classificati in massimo, minimo o flesso (criterio della derivata seconda)
- **Asintoti** — verticali, orizzontali e obliqui
- **Segno** — tabella degli intervalli di positività/negatività
- **Grafico interattivo** — canvas HTML5 con pan, zoom, retta tangente mobile e crosshair in tempo reale

Sintassi supportata: `x**2`, `sin(x)`, `log(x)`, `sqrt(x)`, `exp(x)`, `abs(x)`, `pi`, ecc.

---

### 02 · Italiano — Word Cloud & Analisi Lessicale

Analisi statistica di qualsiasi testo letterario (pensato per la Divina Commedia).

- Rimozione delle **stopwords italiane** (lista integrata)
- Normalizzazione maiuscole/minuscole e punteggiatura
- **Word cloud** proporzionale alla frequenza
- **Bar chart** animato delle top-N parole
- Statistiche: parole totali, parole uniche, stopwords rimosse, parola più frequente

Tutto elaborato **lato client** in JavaScript — nessuna chiamata al server.

---

### 03 · Storia — Cifratore/Decifratore Enigma

Simulazione fedele della macchina **Enigma** usata nella Seconda Guerra Mondiale.

- 5 rotori storici (I–V) con cablaggio originale
- Riflettore **UKW-B** standard
- Meccanismo di **double-stepping** correttamente implementato
- Posizione iniziale configurabile (es. `AAA`, `XKZ`)
- Display telescrivente animato con effetto macchina da scrivere
- Visualizzatore delle posizioni finali dei rotori

> Enigma è **simmetrica**: cifrare un messaggio già cifrato con la stessa configurazione lo decifra.

---

### 04 · Chimica — Prossimamente

Tavola periodica interattiva e verificatore di isomeria molecolare. (Le energie si sono esaurite prima della consegna.)

---

## Installazione

```bash
# Clona il repository
git clone https://github.com/tuo-username/progetto-informatica.git
cd progetto-informatica

# Crea un virtualenv (opzionale ma consigliato)
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Installa le dipendenze
pip install -r requirements.txt

# Avvia il server
python app.py
```

Apri il browser su **http://localhost:5000**.

---

## Dipendenze

| Pacchetto | Utilizzo |
|-----------|----------|
| `Flask >= 3.0` | Web server e routing |
| `SymPy >= 1.12` | Calcolo simbolico (derivate, limiti, dominio) |
| `NumPy >= 1.26` | Valutazione numerica per il grafico |
| `Plotly >= 5.18` | (disponibile, non usato nel frontend attuale) |

Frontend: zero dipendenze npm — solo HTML, CSS e JS vanilla + MathJax via CDN.

---

## API

### `POST /api/analyze`
Analisi completa di una funzione.

```json
// Request
{ "expr": "x**3 - 3*x", "x_min": -6, "x_max": 6 }

// Response (selezione)
{
  "f_latex": "x^{3} - 3 x",
  "d1_expr": "3 x^{2} - 3",
  "d2_expr": "6 x",
  "dominio": "\\mathbb{R}",
  "critical_points": [{ "x": -1.0, "y": 2.0, "type": "massimo" }, ...],
  "asymptotes": [],
  "xs": [...], "ys": [...], "d1s": [...], "d2s": [...]
}
```

### `POST /api/point`
Valori di f, f′ e f″ in un singolo punto.

### `POST /api/enigma`
Cifratura Enigma lato server (specchiata in JS per uso offline).

```json
// Request
{ "text": "HELLO WORLD", "rotor1": "I", "rotor2": "II", "rotor3": "III", "key": "AAA" }

// Response
{ "output": "MFNCZ YVWGR", "final_positions": { "r1": "A", "r2": "A", "r3": "H" } }
```

---

## Note tecniche

- La cifratura Enigma è implementata **sia in Python** (`app.py`) **che in JavaScript** (`storia.js`): il frontend usa la versione JS per evitare latenza, il backend esiste come fallback e punto di verifica.
- Il grafico matematico è disegnato su `<canvas>` senza librerie esterne: assi, griglia, zoom e pan sono gestiti a mano.
- Il word cloud è generato interamente in JS con posizionamento flexbox casuale — nessun D3 o librerie simili.

---

## Autore

**Cristian Agostini** · Classe 5El  
Progetto di Informatica — a.s. 2024/25
