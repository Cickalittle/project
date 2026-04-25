// Rotori storici (wiring alfabeti)
const ROTORS = {
  I:   { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II:  { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  IV:  { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V:   { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' },
};

// Riflettore UKW-B (standard)
const REFLECTOR = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';

// Classe Rotor
class Rotor {
  constructor(name, position = 'A') {
    const data = ROTORS[name];
    this.wiring  = data.wiring;
    this.notch   = data.notch;
    this.pos     = position.charCodeAt(0) - 65; // 0-25
  }

  step() {
    this.pos = (this.pos + 1) % 26;
  }

  atNotch() {
    return String.fromCharCode(this.pos + 65) === this.notch;
  }

  forward(c) {
    const shifted = (c + this.pos) % 26;
    const out     = this.wiring.charCodeAt(shifted) - 65;
    return (out - this.pos + 26) % 26;
  }

  backward(c) {
    const shifted = (c + this.pos) % 26;
    const idx     = this.wiring.indexOf(String.fromCharCode(shifted + 65));
    return (idx - this.pos + 26) % 26;
  }

  getPosition() {
    return String.fromCharCode(this.pos + 65);
  }
}

// Classe Enigma
class Enigma {
  constructor(r1name, r2name, r3name, startKey) {
    const k = (startKey + 'AAA').toUpperCase().replace(/[^A-Z]/g, 'A');
    this.r1 = new Rotor(r1name, k[0]);
    this.r2 = new Rotor(r2name, k[1]);
    this.r3 = new Rotor(r3name, k[2]);
  }

  // Avanzamento rotori (meccanismo double-stepping)
  stepRotors() {
    const r2AtNotch = this.r2.atNotch();
    const r3AtNotch = this.r3.atNotch();

    if (r2AtNotch) {
      this.r2.step();
      this.r1.step();
    } else if (r3AtNotch) {
      this.r2.step();
    }
    this.r3.step();
  }

  // Cifra un singolo carattere
  encryptChar(c) {
    this.stepRotors();
    let n = c.charCodeAt(0) - 65;

    // Percorso avanti: R3 → R2 → R1
    n = this.r3.forward(n);
    n = this.r2.forward(n);
    n = this.r1.forward(n);

    // Riflettore
    n = REFLECTOR.charCodeAt(n) - 65;

    // Percorso indietro: R1 → R2 → R3
    n = this.r1.backward(n);
    n = this.r2.backward(n);
    n = this.r3.backward(n);

    return String.fromCharCode(n + 65);
  }

  // Cifra stringa (ignora non-lettere)
  encrypt(text) {
    return text.toUpperCase().split('').map(ch => {
      if (ch >= 'A' && ch <= 'Z') return this.encryptChar(ch);
      return ch === ' ' ? ' ' : '';
    }).join('');
  }

  getPositions() {
    return {
      r1: this.r1.getPosition(),
      r2: this.r2.getPosition(),
      r3: this.r3.getPosition(),
    };
  }
}

// Elementi DOM
const rotor1Sel   = document.getElementById('rotor1');
const rotor2Sel   = document.getElementById('rotor2');
const rotor3Sel   = document.getElementById('rotor3');
const keyInput    = document.getElementById('rotor-key');
const msgInput    = document.getElementById('msg-input');
const btnCifra    = document.getElementById('btn-cifra');
const btnDecifra  = document.getElementById('btn-decifra');
const output      = document.getElementById('teletype-output');
const meta        = document.getElementById('teletype-meta');
const stats       = document.getElementById('teletype-stats');
const signalDot   = document.getElementById('signal-dot');
const wheel1      = document.getElementById('wheel1');
const wheel2      = document.getElementById('wheel2');
const wheel3      = document.getElementById('wheel3');

// Aggiorna display ruote
function updateWheels(pos, animate = false) {
  [wheel1, wheel2, wheel3].forEach((el, i) => {
    const newLetter = [pos.r1, pos.r2, pos.r3][i];
    if (el.textContent !== newLetter) {
      if (animate) {
        el.classList.remove('spin');
        void el.offsetWidth; // reflow
        el.classList.add('spin');
      }
      el.textContent = newLetter;
    }
  });
}

// Inizializza le ruote con la posizione di partenza
function syncWheelsToKey() {
  const k = (keyInput.value + 'AAA').toUpperCase().replace(/[^A-Z]/g, 'A');
  wheel1.textContent = k[0];
  wheel2.textContent = k[1];
  wheel3.textContent = k[2];
}
keyInput.addEventListener('input', syncWheelsToKey);
syncWheelsToKey();

// Validazione chiave
function getKey() {
  const raw = keyInput.value.toUpperCase().replace(/[^A-Z]/g, '');
  return (raw + 'AAA').slice(0, 3);
}

// Animazione telescrivente
function typewriterDisplay(text, onFinish) {
  output.innerHTML = '';
  signalDot.classList.add('active');

  // Mostra i caratteri a gruppetti di 5
  const groups = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    buf += text[i];
    if (buf.length === 5 && text[i] !== ' ') {
      groups.push(buf + ' ');
      buf = '';
    }
  }
  if (buf) groups.push(buf);

  const flat = groups.join('').split('');
  let i = 0;
  const baseDelay = flat.length > 200 ? 8 : 30;

  function next() {
    if (i >= flat.length) {
      // Cursore finale
      const cursor = document.createElement('span');
      cursor.className = 'cursor-blink';
      cursor.textContent = '█';
      output.appendChild(cursor);
      signalDot.classList.remove('active');
      if (onFinish) onFinish();
      return;
    }

    const span = document.createElement('span');
    span.className = 'char-reveal';
    span.style.animationDelay = '0s';
    span.textContent = flat[i];
    output.appendChild(span);
    i++;

    setTimeout(next, baseDelay + Math.random() * 10);
  }
  next();
}

// Esegui cifratura/decifratura
function runEnigma(mode) {
  const text    = msgInput.value.trim();
  const r1name  = rotor1Sel.value;
  const r2name  = rotor2Sel.value;
  const r3name  = rotor3Sel.value;
  const key     = getKey();

  if (!text) {
    meta.textContent = 'ERRORE: NESSUN MESSAGGIO';
    output.innerHTML = '<span style="color:var(--red-alert)">INSERIRE IL TESTO DA ' + (mode === 'cifra' ? 'CIFRARE' : 'DECIFRARE') + '</span>';
    stats.textContent = '';
    return;
  }

  // Crea la macchina Enigma
  const enigma = new Enigma(r1name, r2name, r3name, key);
  const result = enigma.encrypt(text);
  const finalPos = enigma.getPositions();

  const modeLabel = mode === 'cifra' ? 'CIFRATURA' : 'DECIFRATURA';
  meta.textContent = `${modeLabel} — ROTORI: ${r1name}/${r2name}/${r3name} — CHIAVE: ${key}`;

  const inputClean = text.toUpperCase().replace(/[^A-Z ]/g, '');
  const charCount  = inputClean.replace(/ /g, '').length;

  stats.textContent = `CARATTERI: ${charCount} — ROTORI FINALI: ${finalPos.r1}/${finalPos.r2}/${finalPos.r3}`;

  // Aggiorna ruote con animazione
  updateWheels(finalPos, true);

  // Avvia display telescrivente
  typewriterDisplay(result, () => {
    stats.textContent += ' — TRASMISSIONE COMPLETATA';
  });
}

// Event listeners bottoni
btnCifra.addEventListener('click', () => runEnigma('cifra'));
btnDecifra.addEventListener('click', () => runEnigma('decifra'));

// Enter nel campo chiave → non fa submit, normalizza
keyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnCifra.click();
});

msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey) btnCifra.click();
});

// Esempi rapidi
document.querySelectorAll('.example-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    msgInput.value    = btn.dataset.msg;
    keyInput.value    = btn.dataset.key;
    rotor1Sel.value   = btn.dataset.r1;
    rotor2Sel.value   = btn.dataset.r2;
    rotor3Sel.value   = btn.dataset.r3;
    syncWheelsToKey();
    // Auto-cifra
    runEnigma('cifra');
  });
});

// Normalizza chiave (solo A-Z, 3 caratteri)
keyInput.addEventListener('input', () => {
  let val = keyInput.value.toUpperCase().replace(/[^A-Z]/g, '');
  if (val.length > 3) val = val.slice(0, 3);
  keyInput.value = val;
});
