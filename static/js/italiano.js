
//  Stopwords italiane
const STOPWORDS = new Set([
  'e','il','la','di','che','non','si','in','un','a','per','è','con','del',
  'le','lo','gli','i','mi','ti','ci','vi','ne','al','dal','nel','sul','col',
  'tra','fra','ma','o','se','come','più','già','ora','poi','su','da','ha',
  'ho','ai','dei','alle','agli','sua','suo','mia','mio','una','uno','li',
  'cui','chi','che','quando','dove','perché','però','così','anche','molto',
  'ogni','tutto','tutti','tutta','tutte','altro','altri','altra','altre',
  'questo','questa','questi','queste','quello','quella','quelli','quelle',
  'essere','avere','fare','dire','vedere','sapere','volere','potere','dovere',
  'fu','era','sono','sei','siamo','siete','sarà','sarei','fosse','stata',
  'stato','stati','me','te','lui','lei','noi','voi','loro','miei','tuoi',
  'suoi','nostri','vostri','suoi','tuo','tua','mio','mia','nostro','nostra',
  'ad','ed','od','né','nè','vel','ve','col','coi','pei','pe','sulle','sulla',
  'nelle','nella','degli','dello','della','delle','sull','nell','dell',
  'po','là','lì','qua','qui','mai','nulla','niente','quel','qual','se',
  'no','sì','eh','ah','oh','ahi','ah','beh','or','ben','men','tan',
]);

// Testo di esempio: incipit Inferno, Canto I 
const ESEMPIO = `Nel mezzo del cammin di nostra vita
mi ritrovai per una selva oscura,
ché la diritta via era smarrita.
Ahi quanto a dir qual era è cosa dura
esta selva selvaggia e aspra e forte
che nel pensier rinova la paura!
Tant'è amara che poco è più morte;
ma per trattar del ben ch'i' vi trovai,
dirò de l'altre cose ch'i' v'ho scorte.`;

// Palette word cloud
const WC_COLORS = [
  '#7a2535', '#9e3347', '#b8860b', '#8b7355',
  '#5a4030', '#c4a882', '#3d3a35', '#a0522d',
];

// Elementi DOM
const textInput   = document.getElementById('text-input');
const charCount   = document.getElementById('char-count');
const exampleBtn  = document.getElementById('example-btn');
const analyzeBtn  = document.getElementById('analyze-btn');
const errorBadge  = document.getElementById('error-badge');
const navBadge    = document.getElementById('nav-badge');

const placeholder    = document.getElementById('placeholder');
const resultsWrap    = document.getElementById('results-wrap');
const statsSection   = document.getElementById('stats-section');

const wcContainer    = document.getElementById('wordcloud-container');
const barContainer   = document.getElementById('barchart-container');
const listContainer  = document.getElementById('wordlist-container');

const wcMeta    = document.getElementById('wc-meta');
const barMeta   = document.getElementById('bar-meta');
const listMeta  = document.getElementById('list-meta');
const topnLabel = document.getElementById('topn-label');

const statTotale = document.getElementById('stat-totale');
const statUniche = document.getElementById('stat-uniche');
const statStop   = document.getElementById('stat-stop');
const statTop1   = document.getElementById('stat-top1');

const optStopwords = document.getElementById('opt-stopwords');
const optPunct     = document.getElementById('opt-punct');
const optLower     = document.getElementById('opt-lower');
const optTopn      = document.getElementById('opt-topn');

// Contatore caratteri
textInput.addEventListener('input', () => {
  charCount.textContent = `${textInput.value.length} caratteri`;
});

// Esempio rapido
exampleBtn.addEventListener('click', () => {
  textInput.value = ESEMPIO;
  charCount.textContent = `${ESEMPIO.length} caratteri`;
});

// Analisi testo
function analyzeText() {
  errorBadge.textContent = '';
  const raw = textInput.value.trim();
  if (!raw) {
    errorBadge.textContent = 'Inserisci un testo prima di analizzare.';
    return;
  }

  let text = raw;

  // Rimuovi punteggiatura
  if (optPunct.checked) {
    text = text.replace(/[.,;:!?«»""''()\[\]{}\-–—\/\\|]/g, ' ');
  }

  // Normalizza a minuscolo
  if (optLower.checked) text = text.toLowerCase();

  // Tokenizza
  const allTokens = text.split(/\s+/).filter(w => w.length > 1);

  // Rimuovi stopwords
  let stopRemoved = 0;
  const tokens = allTokens.filter(w => {
    const clean = w.replace(/['''`]/g, "'").split("'").pop(); // gestisce "dell'", "ch'i"
    if (optStopwords.checked && (STOPWORDS.has(w) || STOPWORDS.has(clean))) {
      stopRemoved++;
      return false;
    }
    return true;
  });

  if (tokens.length === 0) {
    errorBadge.textContent = 'Nessuna parola significativa trovata.';
    return;
  }

  // Conta frequenze
  const freq = {};
  for (const w of tokens) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Ordina per frequenza
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const topN = parseInt(optTopn.value);
  const top  = sorted.slice(0, topN);
  const maxFreq = top[0][1];

  // Aggiorna statistiche
  statTotale.textContent = allTokens.length;
  statUniche.textContent = Object.keys(freq).length;
  statStop.textContent   = stopRemoved;
  statTop1.textContent   = sorted[0][0];
  statsSection.style.display = '';
  navBadge.textContent = `${allTokens.length} parole · ${Object.keys(freq).length} uniche`;
  topnLabel.textContent = Math.min(topN, sorted.length);

  // Word Cloud
  wcContainer.innerHTML = '';
  // Usa tutte le parole (max 60) con dimensione proporzionale
  const wcWords = sorted.slice(0, 60);
  const wcMax = wcWords[0][1];
  const wcMin = wcWords[wcWords.length - 1][1];

  const shuffled = [...wcWords].sort(() => Math.random() - 0.48);

  shuffled.forEach(([word, count], i) => {
    const ratio = wcMax === wcMin ? 0.5 : (count - wcMin) / (wcMax - wcMin);
    const size  = 0.75 + ratio * 2.1; // rem, da 0.75 a 2.85
    const color = WC_COLORS[i % WC_COLORS.length];
    const opacity = 0.45 + ratio * 0.55;

    const span = document.createElement('span');
    span.className = 'wc-word';
    span.textContent = word;
    span.style.fontSize   = `${size}rem`;
    span.style.color      = color;
    span.style.opacity    = opacity;
    span.title = `${word}: ${count} ${count === 1 ? 'volta' : 'volte'}`;
    wcContainer.appendChild(span);
  });

  wcMeta.textContent = `${Math.min(60, sorted.length)} parole`;

  // Bar chart
  barContainer.innerHTML = '';
  top.forEach(([word, count], i) => {
    const pct = (count / maxFreq) * 100;

    const row = document.createElement('div');
    row.className = 'bar-row';

    row.innerHTML = `
      <div class="bar-label" title="${word}">${word}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%; animation-delay:${i * 0.04}s"></div>
      </div>
      <div class="bar-count">${count}</div>
    `;
    barContainer.appendChild(row);
  });

  barMeta.textContent = `max: ${maxFreq} ${maxFreq === 1 ? 'occorrenza' : 'occorrenze'}`;

  // Word list completa
  listContainer.innerHTML = '';
  sorted.forEach(([word, count]) => {
    const pill = document.createElement('div');
    pill.className = 'word-pill';
    pill.innerHTML = `<span class="pill-word">${word}</span><span class="pill-count">${count}</span>`;
    listContainer.appendChild(pill);
  });

  listMeta.textContent = `${sorted.length} parole`;

  // Mostra risultati
  placeholder.style.display  = 'none';
  resultsWrap.style.display  = '';
}

analyzeBtn.addEventListener('click', analyzeText);

textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) analyzeText();
});
