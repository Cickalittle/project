from flask import Flask, render_template, request, jsonify
import sympy as sp
from sympy import (
    symbols, sympify, diff, solve, limit, oo, Rational,
    latex, simplify, log, sqrt, Abs, exp, sin, cos, tan,
    asin, acos, atan, sinh, cosh, tanh, S, nan
)
from sympy.calculus.util import continuous_domain
import numpy as np
import json
import traceback
import re

app = Flask(__name__)
x = symbols('x', real=True)

REPLACEMENTS = [
    (r'\^', '**'),
    (r'\blog\b', 'log'),
    (r'\bln\b', 'log'),
    (r'\bsin\b', 'sin'),
    (r'\bcos\b', 'cos'),
    (r'\btan\b', 'tan'),
    (r'\bsqrt\b', 'sqrt'),
    (r'\babs\b', 'Abs'),
]

def parse_expr(raw: str):
    s = raw.strip()
    for pattern, repl in REPLACEMENTS:
        s = re.sub(pattern, repl, s)
    return sp.sympify(s, locals={
        'x': x, 'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan,
        'log': sp.log, 'sqrt': sp.sqrt, 'Abs': sp.Abs,
        'E': sp.E, 'pi': sp.pi, 'exp': sp.exp,
        'asin': sp.asin, 'acos': sp.acos, 'atan': sp.atan,
        'sinh': sp.sinh, 'cosh': sp.cosh, 'tanh': sp.tanh,
    })

def safe_float(val):
    try:
        v = float(val)
        return v if np.isfinite(v) else None
    except Exception:
        return None

# HOME
@app.route('/')
def index():
    return render_template('index.html')

# MATEMATICA 
@app.route('/matematica')
def matematica():
    return render_template('matematica.html', funzione_input='', errore=None)

@app.route('/api/analyze', methods=['POST'])
def analyze_function():
    """API per l'analisi completa di una funzione"""
    data = request.get_json()
    raw = data.get('expr', 'x')
    x_min = float(data.get('x_min', -6))
    x_max = float(data.get('x_max', 6))
    n_points = int(data.get('n_points', 1200))

    try:
        f_expr = parse_expr(raw)
    except Exception as e:
        return jsonify({'error': f'Espressione non valida: {str(e)}'}), 400

    result = {}

    # 1. DERIVATE
    try:
        d1_expr = sp.diff(f_expr, x)
        d2_expr = sp.diff(d1_expr, x)
        result['d1_expr'] = latex(simplify(d1_expr))
        result['d2_expr'] = latex(simplify(d2_expr))
    except Exception as e:
        result['d1_expr'] = "Errore"
        result['d2_expr'] = "Errore"
        d1_expr, d2_expr = None, None

    # 2. DOMINIO 
    try:
        dom = continuous_domain(f_expr, x, S.Reals)
        result['dominio'] = latex(dom)
    except Exception:
        result['dominio'] = r'\mathbb{R}'

    # 3. INTERSEZIONI
    try:
        f0 = f_expr.subs(x, 0)
        result['asse_y'] = f"(0, {latex(f0)})" if f0.is_finite else "Non nel dominio"
    except Exception:
        result['asse_y'] = "?"

    try:
        zeri = solve(f_expr, x)
        zeri_reali = [z for z in zeri if z.is_real]
        if zeri_reali:
            result['asse_x'] = ', '.join([f"({latex(z)}, 0)" for z in zeri_reali])
        else:
            result['asse_x'] = "Nessuna intersezione reale"
    except Exception:
        result['asse_x'] = "?"

    # 4. SEGNO 
    try:
        zeri_segno = solve(f_expr, x)
        zeri_reali_segno = sorted([z for z in zeri_segno if z.is_real and z.is_finite])
        singolarita = []
        try:
            denom = sp.denom(f_expr)
            if denom != 1:
                sing = solve(denom, x)
                singolarita = sorted([s for s in sing if s.is_real and s.is_finite])
        except Exception:
            pass

        punti_critici_segno = sorted(set(zeri_reali_segno + singolarita))
        segno_info = []

        if not punti_critici_segno:
            test_val = f_expr.subs(x, 0).evalf() if f_expr.subs(x, 0).is_finite else f_expr.subs(x, 1).evalf()
            if test_val.is_real:
                segno = '> 0' if test_val > 0 else '< 0'
                segno_info.append({'intervallo': r'\mathbb{R}', 'segno': segno})
        else:
            test_points = [punti_critici_segno[0] - 1]
            for i in range(len(punti_critici_segno) - 1):
                test_points.append((punti_critici_segno[i] + punti_critici_segno[i+1]) / 2)
            test_points.append(punti_critici_segno[-1] + 1)

            intervals = [f"(-\\infty, {latex(punti_critici_segno[0])})"]
            for i in range(len(punti_critici_segno) - 1):
                intervals.append(f"({latex(punti_critici_segno[i])}, {latex(punti_critici_segno[i+1])})")
            intervals.append(f"({latex(punti_critici_segno[-1])}, +\\infty)")

            for tp, inv in zip(test_points, intervals):
                try:
                    val = f_expr.subs(x, tp).evalf()
                    if val.is_real:
                        segno = '> 0' if val > 0 else ('< 0' if val < 0 else '= 0')
                    else:
                        segno = 'non reale'
                    segno_info.append({'intervallo': inv, 'segno': segno})
                except Exception:
                    segno_info.append({'intervallo': inv, 'segno': '?'})
        result['segno'] = segno_info
    except Exception as e:
        result['segno'] = [{'intervallo': '?', 'segno': str(e)}]

    # 5. PUNTI CRITICI (f' = 0) 
    critical_points = []
    if d1_expr:
        try:
            # Risoluzione esatta di f'(x) = 0
            cp_solutions = solve(d1_expr, x)
            seen_x = set()
            
            for cp in cp_solutions:
                # Filtra solo soluzioni reali e finite
                if cp.is_real and cp.is_finite:
                    x_val = float(cp.evalf())
                    # Evita duplicati
                    if abs(x_val) in seen_x or x_val in seen_x:
                        continue
                    seen_x.add(x_val)
                    
                    # Controlla se è nel range o vicino
                    if x_min - 1 <= x_val <= x_max + 1:
                        try:
                            y_val = f_expr.subs(x, cp)
                            d2_val = d2_expr.subs(x, cp) if d2_expr else 0
                            d2_float = float(d2_val.evalf()) if d2_val else 0
                            
                            if d2_float > 1e-6:
                                tipo = "minimo"
                            elif d2_float < -1e-6:
                                tipo = "massimo"
                            else:
                                tipo = "flesso"
                                
                            critical_points.append({
                                'x': round(x_val, 5),
                                'y': round(float(y_val.evalf()), 5),
                                'type': tipo
                            })
                        except Exception:
                            critical_points.append({
                                'x': round(x_val, 5),
                                'y': None,
                                'type': "critico"
                            })
                                                        
        except Exception as e:
            print(f"Errore nella ricerca punti critici: {e}")
    
    # Ordina i punti critici per x
    critical_points.sort(key=lambda p: p['x'])
    result['critical_points'] = critical_points

    # 6. ASINTOTI
    asymptotes = []
    # Verticali
    try:
        denom = sp.denom(f_expr)
        if denom != 1:
            sing = solve(denom, x)
            for s in sing:
                if s.is_real and s.is_finite:
                    lim_dx = limit(f_expr, x, s, '+')
                    lim_sx = limit(f_expr, x, s, '-')
                    if lim_dx in [oo, -oo] or lim_sx in [oo, -oo]:
                        asymptotes.append({
                            'type': 'verticale',
                            'value': float(s.evalf()),
                            'equation': f'x = {latex(s)}'
                        })
    except Exception:
        pass

    # Orizzontali e obliqui
    try:
        lim_pos = limit(f_expr, x, oo)
        if lim_pos.is_finite:
            asymptotes.append({
                'type': 'orizzontale',
                'value': float(lim_pos.evalf()),
                'equation': f'y = {latex(lim_pos)}',
                'direction': '+∞'
            })
    except Exception:
        pass

    try:
        lim_neg = limit(f_expr, x, -oo)
        if lim_neg.is_finite and (not asymptotes or abs(float(lim_neg.evalf()) - float(asymptotes[0].get('value', 0))) > 1e-6):
            asymptotes.append({
                'type': 'orizzontale',
                'value': float(lim_neg.evalf()),
                'equation': f'y = {latex(lim_neg)}',
                'direction': '-∞'
            })
    except Exception:
        pass

    result['asymptotes'] = asymptotes

    # 7. DATI PER IL GRAFICO
    modules = ['numpy', {'Abs': np.abs, 'log': np.log, 'sqrt': np.sqrt}]
    try:
        f_lam = sp.lambdify(x, f_expr, modules)
        d1_lam = sp.lambdify(x, d1_expr, modules) if d1_expr else None
        d2_lam = sp.lambdify(x, d2_expr, modules) if d2_expr else None
    except Exception:
        return jsonify({'error': 'Errore nella compilazione della funzione'}), 400

    xs = np.linspace(x_min, x_max, n_points).tolist()

    ys = []
    d1s = []
    d2s = []

    for xi in xs:
        try:
            val = f_lam(xi)
            ys.append(safe_float(val))
        except Exception:
            ys.append(None)

        if d1_lam:
            try:
                val = d1_lam(xi)
                d1s.append(safe_float(val))
            except Exception:
                d1s.append(None)
        else:
            d1s.append(None)

        if d2_lam:
            try:
                val = d2_lam(xi)
                d2s.append(safe_float(val))
            except Exception:
                d2s.append(None)
        else:
            d2s.append(None)

    result['xs'] = xs
    result['ys'] = ys
    result['d1s'] = d1s
    result['d2s'] = d2s
    result['expr'] = raw
    result['f_latex'] = latex(f_expr)
    result['x_min'] = x_min
    result['x_max'] = x_max

    return jsonify(result)


@app.route('/api/point', methods=['POST'])
def point_value():
    data = request.get_json()
    raw = data.get('expr', 'x')
    xv = float(data.get('x', 0))
    try:
        f_expr = parse_expr(raw)
        d1_expr = sp.diff(f_expr, x)
        d2_expr = sp.diff(d1_expr, x)
        modules = ['numpy', {'Abs': np.abs, 'log': np.log, 'sqrt': np.sqrt}]
        f_lam = sp.lambdify(x, f_expr, modules)
        d1_lam = sp.lambdify(x, d1_expr, modules)
        d2_lam = sp.lambdify(x, d2_expr, modules)
        return jsonify({
            'fx': safe_float(f_lam(xv)),
            'd1': safe_float(d1_lam(xv)),
            'd2': safe_float(d2_lam(xv)),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/italiano')
def italiano():
    return render_template('italiano.html')

@app.route('/chimica')
def chimica():
    return render_template('coming_soon.html', materia='Chimica', desc='Tavola periodica interattiva e isomeria molecolare')

@app.route('/storia')
def storia():
    return render_template('storia.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
