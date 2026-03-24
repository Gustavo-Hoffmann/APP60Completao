# -*- coding: utf-8 -*-
"""
sl30s_runtime.py

Runtime do teste Sentar e Levantar (SL30S/30STS) no mesmo esquema do worker da marcha.

Objetivo:
- ler o CSV bruto do app60
- reproduzir a lógica principal do notebook "30STS - APP Gustavo 01 - métricas"
- não exportar arquivos locais
- retornar métricas + payload do gráfico em memória para gravar no Supabase

Observações importantes:
- o notebook usa orientação estimada por Madgwick e detecta os ciclos no ângulo X em graus
- aqui a lógica foi portada para Python puro, sem depender do pacote `ahrs`
- a estrutura final foi organizada para caber bem em `metrics_json`
"""

from __future__ import annotations

import math
from statistics import NormalDist
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy.interpolate import CubicSpline
from scipy.signal import butter, filtfilt, find_peaks

FS = 60.0
DT = 1.0 / FS
ACC_CUTOFF_HZ = 1.3
GYR_CUTOFF_HZ = 3.0
BUTTER_ORDER = 4
PEAK_MIN_DISTANCE = 15
PEAK_PROMINENCE = 1.0
MADGWICK_BETA = 0.15
WINDOW_SEC = 30.0
CHAIR_HEIGHT_M = 0.46
BODY_MASS_FACTOR = 0.9
GRAVITY = 9.81

NORM_30STS: Dict[str, Dict[str, Dict[str, float]]] = {
    "F": {
        "60-64": {"mean": 15.4, "sd": 4.3},
        "65-69": {"mean": 13.5, "sd": 4.3},
        "70-74": {"mean": 12.9, "sd": 3.7},
        "75-79": {"mean": 12.5, "sd": 3.9},
        "80-84": {"mean": 10.3, "sd": 4.0},
        "85-89": {"mean": 8.0, "sd": 5.1},
        "90-94": {"mean": 6.0, "sd": 4.0},
    },
    "M": {
        "60-64": {"mean": 16.4, "sd": 3.3},
        "65-69": {"mean": 15.2, "sd": 4.5},
        "70-74": {"mean": 14.5, "sd": 4.2},
        "75-79": {"mean": 14.0, "sd": 4.3},
        "80-84": {"mean": 12.4, "sd": 3.9},
        "85-89": {"mean": 10.3, "sd": 4.0},
        "90-94": {"mean": 9.7, "sd": 6.8},
    },
}


# ==========================================================
# HELPERS GERAIS
# ==========================================================

def round2(value: Any) -> Optional[float]:
    try:
        v = float(value)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return round(v, 2)


def round3(value: Any) -> Optional[float]:
    try:
        v = float(value)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return round(v, 3)


def normalize_sex(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip().upper()
    if s in {"M", "MALE", "MASC", "MASCULINO", "HOMEM"}:
        return "M"
    if s in {"F", "FEMALE", "FEM", "FEMININO", "MULHER"}:
        return "F"
    return None


def age_to_bin_label(age: int) -> str:
    if age < 60:
        return "< 60"
    if age <= 64:
        return "60-64"
    if age <= 69:
        return "65-69"
    if age <= 74:
        return "70-74"
    if age <= 79:
        return "75-79"
    if age <= 84:
        return "80-84"
    if age <= 89:
        return "85-89"
    if age <= 94:
        return "90-94"
    return ">= 95"


def classify_30sts(sex: Optional[str], age: Optional[int], repetitions: int) -> Tuple[str, Optional[float], Optional[float]]:
    if sex is None or age is None:
        return "—", None, None

    age_bin = age_to_bin_label(int(age))
    stats = NORM_30STS.get(sex, {}).get(age_bin)
    if not stats:
        return "Idade fora da faixa da tabela", None, None

    mean_v = float(stats["mean"])
    sd_v = float(stats["sd"])
    lower = mean_v - sd_v
    upper = mean_v + sd_v

    if repetitions < lower:
        status = "Abaixo da média"
    elif repetitions > upper:
        status = "Acima da média"
    else:
        status = "Na média"

    if sd_v <= 0:
        return status, None, None

    z_score = (float(repetitions) - mean_v) / sd_v
    percentile = NormalDist().cdf(z_score) * 100.0
    return status, round2(z_score), round1(percentile)


def round1(value: Any) -> Optional[float]:
    try:
        v = float(value)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return round(v, 1)


def mean_or_none(values: List[float] | np.ndarray) -> Optional[float]:
    arr = np.asarray(values, dtype=float)
    if arr.size == 0:
        return None
    return float(np.mean(arr))


def sum_or_zero(values: List[float] | np.ndarray) -> float:
    arr = np.asarray(values, dtype=float)
    if arr.size == 0:
        return 0.0
    return float(np.sum(arr))


def parse_metadata_from_csv(file_path: str) -> Dict[str, str]:
    meta: Dict[str, str] = {}
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.startswith("#"):
                break
            raw = line[1:].strip()
            if "=" not in raw:
                continue
            key, value = raw.split("=", 1)
            meta[key.strip()] = value.strip()
    return meta


def infer_body_mass_kg(meta: Dict[str, str], default: float = 70.0) -> float:
    try:
        value = float(meta.get("body_mass_kg", default))
    except Exception:
        value = default
    if not math.isfinite(value) or value <= 0:
        value = default
    return float(value)


def infer_height_cm(meta: Dict[str, str], default: float = 170.0) -> float:
    try:
        value = float(meta.get("height_cm", default))
    except Exception:
        value = default
    if value <= 3.0:
        value *= 100.0
    if not math.isfinite(value) or value <= 0:
        value = default
    return float(value)


def compute_bmi(body_mass_kg: Optional[float], height_cm: Optional[float]) -> Optional[float]:
    if body_mass_kg is None or height_cm is None:
        return None
    h_m = float(height_cm) / 100.0
    if h_m <= 0:
        return None
    return round3(float(body_mass_kg) / (h_m * h_m))


# ==========================================================
# ENTRADA E PRÉ-PROCESSAMENTO
# ==========================================================

def load_app60_sl30s_csv(file_path: str) -> Tuple[pd.DataFrame, Dict[str, str]]:
    meta = parse_metadata_from_csv(file_path)
    df = pd.read_csv(file_path, comment="#")

    required = ["row_t_ms", "ax", "ay", "az", "gx", "gy", "gz"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"CSV bruto do SL30S sem colunas obrigatórias: {missing}")

    out = pd.DataFrame({
        "time_s": pd.to_numeric(df["row_t_ms"], errors="coerce") / 1000.0,
        "ax": pd.to_numeric(df["ax"], errors="coerce"),
        "ay": pd.to_numeric(df["ay"], errors="coerce"),
        "az": pd.to_numeric(df["az"], errors="coerce"),
        "gx": pd.to_numeric(df["gx"], errors="coerce"),
        "gy": pd.to_numeric(df["gy"], errors="coerce"),
        "gz": pd.to_numeric(df["gz"], errors="coerce"),
    })

    out = (
        out
        .replace([np.inf, -np.inf], np.nan)
        .dropna(subset=["time_s", "ax", "ay", "az", "gx", "gy", "gz"])
        .sort_values("time_s")
        .drop_duplicates(subset=["time_s"])
        .reset_index(drop=True)
    )

    if out.shape[0] < 10:
        raise ValueError("CSV bruto ficou curto demais após limpeza do SL30S.")

    return out, meta


def ajustar_tempo(t_in: np.ndarray, s_in: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    t_diff = np.diff(t_in)
    t_diff = np.insert(t_diff, 0, 0.0)
    t_cum = np.cumsum(t_diff)

    if np.all(np.diff(t_cum) > 0):
        return t_cum.astype(float), s_in.astype(float)

    unique_indices = np.unique(t_cum, return_index=True)[1]
    t_cum = t_cum[unique_indices]
    s_out = s_in[unique_indices]
    order = np.argsort(t_cum)
    return t_cum[order].astype(float), s_out[order].astype(float)


def interpolate_to_regular_grid(
    time_s: np.ndarray,
    acc_xyz: np.ndarray,
    gyr_xyz: np.ndarray,
    *,
    fs: float = FS,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    dt = 1.0 / fs

    ta, acc_clean = ajustar_tempo(time_s, acc_xyz)
    tg, gyr_clean = ajustar_tempo(time_s, gyr_xyz)

    t_start = max(float(np.min(ta)), float(np.min(tg)))
    t_end = min(float(np.max(ta)), float(np.max(tg)))
    if not (t_end > t_start):
        raise ValueError("Intervalo temporal inválido no SL30S.")

    new_time = np.arange(t_start, t_end, dt, dtype=float)
    if new_time.size < 10:
        raise ValueError("Grade temporal regular insuficiente no SL30S.")

    acc_interp = np.zeros((new_time.size, 3), dtype=float)
    gyr_interp = np.zeros((new_time.size, 3), dtype=float)

    for i in range(3):
        acc_interp[:, i] = CubicSpline(ta, acc_clean[:, i])(new_time)
        gyr_interp[:, i] = CubicSpline(tg, gyr_clean[:, i])(new_time)

    return new_time, acc_interp, gyr_interp
def butter_lowpass(data: np.ndarray, cutoff_hz: float, fs: float, order: int = 4) -> np.ndarray:
    nyq = 0.5 * fs
    b, a = butter(order, cutoff_hz / nyq, btype="low", analog=False)
    return filtfilt(b, a, data, axis=0)


# ==========================================================
# MADGWICK + ORIENTAÇÃO
# ==========================================================

def madgwick_imu(acc: np.ndarray, gyr: np.ndarray, *, frequency: float = FS, beta: float = MADGWICK_BETA) -> np.ndarray:
    """
    Implementação enxuta do Madgwick IMU-only.
    Quaternion em ordem [w, x, y, z].
    Giroscópio em rad/s.
    """
    n = int(acc.shape[0])
    if n == 0:
        return np.zeros((0, 4), dtype=float)

    q = np.zeros((n, 4), dtype=float)
    q[0] = np.array([1.0, 0.0, 0.0, 0.0], dtype=float)
    dt = 1.0 / float(frequency)

    for i in range(1, n):
        q1, q2, q3, q4 = q[i - 1]
        gx, gy, gz = (float(v) for v in gyr[i])
        ax, ay, az = (float(v) for v in acc[i])

        grad = np.zeros(4, dtype=float)
        norm_a = math.sqrt(ax * ax + ay * ay + az * az)
        if norm_a > 0.0:
            ax /= norm_a
            ay /= norm_a
            az /= norm_a

            f1 = 2.0 * (q2 * q4 - q1 * q3) - ax
            f2 = 2.0 * (q1 * q2 + q3 * q4) - ay
            f3 = 2.0 * (0.5 - q2 * q2 - q3 * q3) - az

            grad[0] = -2.0 * q3 * f1 + 2.0 * q2 * f2
            grad[1] = 2.0 * q4 * f1 + 2.0 * q1 * f2 - 4.0 * q2 * f3
            grad[2] = -2.0 * q1 * f1 + 2.0 * q4 * f2 - 4.0 * q3 * f3
            grad[3] = 2.0 * q2 * f1 + 2.0 * q3 * f2

            grad_norm = float(np.linalg.norm(grad))
            if grad_norm > 0.0:
                grad /= grad_norm

        q_dot = 0.5 * np.array([
            -q2 * gx - q3 * gy - q4 * gz,
            q1 * gx + q3 * gz - q4 * gy,
            q1 * gy - q2 * gz + q4 * gx,
            q1 * gz + q2 * gy - q3 * gx,
        ], dtype=float) - beta * grad

        q_new = q[i - 1] + q_dot * dt
        q_new_norm = float(np.linalg.norm(q_new))
        if q_new_norm <= 0.0:
            q[i] = q[i - 1]
        else:
            q[i] = q_new / q_new_norm

    return q


def q2euler_xyz(q: np.ndarray) -> np.ndarray:
    """
    Retorna [roll_x, pitch_y, yaw_z] em radianos.
    """
    w, x, y, z = (float(v) for v in q)

    t0 = 2.0 * (w * x + y * z)
    t1 = 1.0 - 2.0 * (x * x + y * y)
    roll = math.atan2(t0, t1)

    t2 = 2.0 * (w * y - z * x)
    t2 = max(-1.0, min(1.0, t2))
    pitch = math.asin(t2)

    t3 = 2.0 * (w * z + x * y)
    t4 = 1.0 - 2.0 * (y * y + z * z)
    yaw = math.atan2(t3, t4)

    return np.array([roll, pitch, yaw], dtype=float)


# ==========================================================
# DETECÇÃO E MÉTRICAS
# ==========================================================

def calc_vel_segmento(t: np.ndarray, y: np.ndarray, idx_ini: int, idx_fim: int) -> Tuple[float, float]:
    t_seg = t[idx_ini:idx_fim + 1]
    y_seg = y[idx_ini:idx_fim + 1]
    if len(t_seg) > 1:
        vel, b = np.polyfit(t_seg, y_seg, 1)
        return float(vel), float(b)
    return 0.0, 0.0


def get_idx_30pc(t: np.ndarray, y: np.ndarray, idx1: int, idx2: int) -> Tuple[int, int]:
    i_start, i_end = min(idx1, idx2), max(idx1, idx2)
    y_segmento = y[i_start:i_end + 1]
    if len(y_segmento) == 0:
        return i_start, i_end

    y_min = float(np.min(y_segmento))
    y_max = float(np.max(y_segmento))
    amplitude = y_max - y_min

    if y[idx2] > y[idx1]:
        target_1 = y_min + 0.3 * amplitude
        target_2 = y_min + 0.7 * amplitude
    else:
        target_1 = y_min + 0.7 * amplitude
        target_2 = y_min + 0.3 * amplitude

    idx_range = np.arange(i_start, i_end + 1)
    idx_v1 = int(idx_range[np.argmin(np.abs(y[idx_range] - target_1))])
    idx_v2 = int(idx_range[np.argmin(np.abs(y[idx_range] - target_2))])
    return min(idx_v1, idx_v2), max(idx_v1, idx_v2)


def build_cycles(signal_x: np.ndarray, new_time: np.ndarray) -> Tuple[int, int, np.ndarray, np.ndarray, List[Dict[str, Any]], np.ndarray]:
    media_x = float(np.mean(signal_x))

    peaks, _ = find_peaks(signal_x, distance=PEAK_MIN_DISTANCE, prominence=PEAK_PROMINENCE)
    vales, _ = find_peaks(-signal_x, distance=PEAK_MIN_DISTANCE, prominence=PEAK_PROMINENCE)
    vales = np.asarray([v for v in vales if v < len(signal_x) - 1], dtype=int)

    limite_pico_inicial = media_x + 3.0
    inicio_mov = 0
    primeiro_pico_idx = -1

    for p in peaks:
        if signal_x[p] > limite_pico_inicial:
            primeiro_pico_idx = int(p)
            break

    if primeiro_pico_idx != -1:
        vales_anteriores = [int(v) for v in vales if v < primeiro_pico_idx]
        if vales_anteriores:
            inicio_mov = vales_anteriores[-1]
        else:
            fatia = signal_x[:primeiro_pico_idx]
            inicio_mov = int(np.argmin(fatia)) if len(fatia) > 0 else 0

    tempo_inicio = float(new_time[inicio_mov])
    tempo_fim_alvo = tempo_inicio + WINDOW_SEC
    fim_mov = int(np.argmin(np.abs(new_time - tempo_fim_alvo)))

    peaks_mov = np.asarray([int(p) for p in peaks if inicio_mov <= p <= fim_mov], dtype=int)
    vales_mov = np.asarray([int(v) for v in vales if inicio_mov <= v <= fim_mov], dtype=int)

    if inicio_mov not in set(vales_mov.tolist()):
        vales_mov = np.asarray(sorted(vales_mov.tolist() + [inicio_mov]), dtype=int)

    t_relativo = new_time - new_time[inicio_mov]

    eventos_globais = ([{"idx": int(p), "tipo": "P"} for p in peaks_mov] +
                       [{"idx": int(v), "tipo": "V"} for v in vales_mov])
    eventos_globais.sort(key=lambda x: x["idx"])

    ciclos_para_plot: List[Dict[str, Any]] = []
    i = 0
    while i <= len(eventos_globais) - 5:
        subset = eventos_globais[i:i + 5]
        padrao = [e["tipo"] for e in subset]
        if padrao == ["V", "P", "V", "P", "V"]:
            idx_start = int(subset[0]["idx"])
            idx_end = int(subset[4]["idx"])
            ciclos_para_plot.append({
                "id": len(ciclos_para_plot) + 1,
                "idx_global_start": idx_start,
                "idx_global_end": idx_end,
                "picos": [int(subset[1]["idx"]), int(subset[3]["idx"])],
                "vales": [int(subset[0]["idx"]), int(subset[2]["idx"]), int(subset[4]["idx"])],
                "duracao": float(t_relativo[idx_end] - t_relativo[idx_start]),
            })
            i += 4
        else:
            i += 1

    return inicio_mov, fim_mov, peaks_mov, vales_mov, ciclos_para_plot, t_relativo


def compute_transition_times(new_time: np.ndarray, signal_x: np.ndarray, ciclos: List[Dict[str, Any]]) -> pd.DataFrame:
    if not ciclos:
        return pd.DataFrame(columns=["Ciclo", "Transição Em Pé", "Transição Sentado"])

    todos_pontos_proj: List[Dict[str, float]] = []

    for ciclo in ciclos:
        v1, p1, v2, p2, v3 = (
            ciclo["vales"][0],
            ciclo["picos"][0],
            ciclo["vales"][1],
            ciclo["picos"][1],
            ciclo["vales"][2],
        )
        fases = [(v1, p1), (p1, v2), (v2, p2), (p2, v3)]

        for idx_ini, idx_fim in fases:
            i30, f30 = get_idx_30pc(new_time, signal_x, idx_ini, idx_fim)
            vel, b = calc_vel_segmento(new_time, signal_x, i30, f30)

            if vel > 0:
                y_target = float(signal_x[idx_ini])
                t_superior = float(new_time[f30])
            else:
                y_target = float(signal_x[idx_fim])
                t_superior = float(new_time[i30])

            t_inferior = (y_target - b) / vel if abs(vel) > 1e-6 else float(new_time[idx_ini])
            todos_pontos_proj.append({"t": float(t_inferior), "y": y_target})

    todos_pontos_proj = sorted(todos_pontos_proj, key=lambda k: k["t"])
    dados_ciclos: Dict[int, Dict[str, Any]] = {}
    count_par = 0
    i = 1
    while i < len(todos_pontos_proj) - 1:
        ponto_a = todos_pontos_proj[i]
        ponto_b = todos_pontos_proj[i + 1]
        tempo = float(ponto_b["t"] - ponto_a["t"])

        if count_par % 2 == 0:
            num_ciclo = (count_par // 2) + 1
            tipo_coluna = "Transição Em Pé"
        else:
            num_ciclo = (count_par // 2) + 2
            tipo_coluna = "Transição Sentado"

        if num_ciclo not in dados_ciclos:
            dados_ciclos[num_ciclo] = {
                "Ciclo": num_ciclo,
                "Transição Em Pé": np.nan,
                "Transição Sentado": np.nan,
            }
        dados_ciclos[num_ciclo][tipo_coluna] = round(float(tempo), 2)

        i += 2
        count_par += 1

    if not dados_ciclos:
        return pd.DataFrame(columns=["Ciclo", "Transição Em Pé", "Transição Sentado"])

    df = pd.DataFrame(list(dados_ciclos.values()))
    df = df[["Ciclo", "Transição Em Pé", "Transição Sentado"]].sort_values("Ciclo").reset_index(drop=True)
    return df


def build_cycle_rows(
    new_time: np.ndarray,
    t_relativo: np.ndarray,
    signal_x: np.ndarray,
    ciclos: List[Dict[str, Any]],
    df_transitions: pd.DataFrame,
    body_mass_kg: float,
    height_cm: float,
    sexo: Optional[str],
    idade: Optional[int],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    trans_pe_list = df_transitions["Transição Em Pé"].fillna(0).tolist() if not df_transitions.empty else []
    trans_sentado_list = df_transitions["Transição Sentado"].fillna(0).tolist() if not df_transitions.empty else []

    tempos_ciclo: List[float] = []
    tempos_levantar: List[float] = []
    tempos_sentar: List[float] = []
    pico1_absoluto_list: List[float] = []
    pico2_absoluto_list: List[float] = []
    amp_flex_levantar: List[float] = []
    amp_ext_levantar: List[float] = []
    amp_flex_sentar: List[float] = []
    amp_ext_sentar: List[float] = []
    vel_flex_levantar: List[float] = []
    vel_ext_levantar: List[float] = []
    vel_flex_sentar: List[float] = []
    vel_ext_sentar: List[float] = []
    rows: List[Dict[str, Any]] = []

    for i, ciclo in enumerate(ciclos):
        idx_v1 = int(ciclo["vales"][0])
        idx_p1 = int(ciclo["picos"][0])
        idx_v2 = int(ciclo["vales"][1])
        idx_p2 = int(ciclo["picos"][1])
        idx_v3 = int(ciclo["vales"][2])

        t_v1 = float(new_time[idx_v1])
        t_v2 = float(new_time[idx_v2])
        t_v3 = float(new_time[idx_v3])

        tempo_total = t_v3 - t_v1
        tempo_levantar = t_v2 - t_v1
        tempo_sentar = t_v3 - t_v2

        tempos_ciclo.append(tempo_total)
        tempos_levantar.append(tempo_levantar)
        tempos_sentar.append(tempo_sentar)

        pico1_abs = float(signal_x[idx_p1])
        pico2_abs = float(signal_x[idx_p2])
        pico1_absoluto_list.append(pico1_abs)
        pico2_absoluto_list.append(pico2_abs)

        flex_lev = abs(float(signal_x[idx_v1] - signal_x[idx_p1]))
        ext_lev = abs(float(signal_x[idx_p1] - signal_x[idx_v2]))
        flex_sen = abs(float(signal_x[idx_v2] - signal_x[idx_p2]))
        ext_sen = abs(float(signal_x[idx_p2] - signal_x[idx_v3]))

        amp_flex_levantar.append(flex_lev)
        amp_ext_levantar.append(ext_lev)
        amp_flex_sentar.append(flex_sen)
        amp_ext_sentar.append(ext_sen)

        vel_fl_lev = flex_lev / tempo_levantar if tempo_levantar != 0 else 0.0
        vel_ex_lev = ext_lev / tempo_levantar if tempo_levantar != 0 else 0.0
        vel_fl_sen = flex_sen / tempo_sentar if tempo_sentar != 0 else 0.0
        vel_ex_sen = ext_sen / tempo_sentar if tempo_sentar != 0 else 0.0

        vel_flex_levantar.append(vel_fl_lev)
        vel_ext_levantar.append(vel_ex_lev)
        vel_flex_sentar.append(vel_fl_sen)
        vel_ext_sentar.append(vel_ex_sen)

        rows.append({
            "cycle": int(i + 1),
            "time_total_s": round2(tempo_total),
            "time_stand_s": round2(tempo_levantar),
            "time_sit_s": round2(tempo_sentar),
            "transition_to_stand_s": round2(trans_pe_list[i]) if i < len(trans_pe_list) else 0.0,
            "transition_to_sit_s": round2(trans_sentado_list[i]) if i < len(trans_sentado_list) else 0.0,
            "frequency_hz": round2((1.0 / tempo_total) if tempo_total != 0 else 0.0),
            "peak1_deg": round2(pico1_abs),
            "peak2_deg": round2(pico2_abs),
            "amp_flex_stand_deg": round2(flex_lev),
            "amp_ext_stand_deg": round2(ext_lev),
            "amp_flex_sit_deg": round2(flex_sen),
            "amp_ext_sit_deg": round2(ext_sen),
            "vel_flex_stand_deg_s": round2(vel_fl_lev),
            "vel_ext_stand_deg_s": round2(vel_ex_lev),
            "vel_flex_sit_deg_s": round2(vel_fl_sen),
            "vel_ext_sit_deg_s": round2(vel_ex_sen),
            "cycle_start_t_rel_s": round3(float(t_relativo[idx_v1])),
            "cycle_end_t_rel_s": round3(float(t_relativo[idx_v3])),
            "valley_indices": [idx_v1, idx_v2, idx_v3],
            "peak_indices": [idx_p1, idx_p2],
        })

    hz_ciclos = [(1.0 / t) if t != 0 else 0.0 for t in tempos_ciclo]
    cv_tempo_total = (
        (float(np.std(tempos_ciclo, ddof=1)) / float(np.mean(tempos_ciclo)) * 100.0)
        if len(tempos_ciclo) > 1 and float(np.mean(tempos_ciclo)) != 0.0
        else 0.0
    )

    height_m = height_cm / 100.0
    h_com_em_pe = height_m * 0.5
    h_deslocamento = h_com_em_pe - CHAIR_HEIGHT_M
    if h_deslocamento < 0.1:
        h_deslocamento = 0.3

    trabalho_por_ciclo = body_mass_kg * BODY_MASS_FACTOR * GRAVITY * h_deslocamento
    potencia_por_ciclo = [(trabalho_por_ciclo / t) if t > 0 else 0.0 for t in tempos_ciclo]
    tempo_total_acumulado = sum_or_zero(tempos_ciclo)
    energia_total_acumulada = trabalho_por_ciclo * len(tempos_ciclo)
    mean_power_global = (energia_total_acumulada / tempo_total_acumulado) if tempo_total_acumulado > 0 else 0.0

    for row, pot in zip(rows, potencia_por_ciclo):
        row["cv_cycle_time_pct"] = round2(cv_tempo_total)
        row["displacement_m"] = round2(h_deslocamento)
        row["work_j"] = round2(trabalho_por_ciclo)
        row["power_w"] = round2(pot)

    total_reps = len(ciclos)
    status_norm, z_val, perc_val = classify_30sts(sexo, idade, total_reps)

    for row in rows:
        row["rikli_jones_classification"] = status_norm
        row["z_score"] = z_val
        row["percentile"] = perc_val

    c_t1 = c_t2 = c_t3 = 0
    for ciclo in ciclos:
        idx_fim = int(ciclo["vales"][2])
        tempo_fim_ciclo = float(t_relativo[idx_fim])
        if tempo_fim_ciclo <= 10.0:
            c_t1 += 1
        elif tempo_fim_ciclo <= 20.0:
            c_t2 += 1
        elif tempo_fim_ciclo <= 30.0:
            c_t3 += 1

    perfil_goda = "-"
    if total_reps > 0:
        if c_t1 == c_t2 == c_t3:
            perfil_goda = "Constante"
        elif (c_t1 < c_t2 > c_t3) or (c_t1 > c_t2 < c_t3):
            perfil_goda = "Flutuante"
        elif (c_t1 > c_t2 > c_t3) or (c_t1 > c_t2 == c_t3) or (c_t1 == c_t2 > c_t3):
            perfil_goda = "Desacelerador"
        elif (c_t1 < c_t2 < c_t3) or (c_t1 < c_t2 == c_t3) or (c_t1 == c_t2 < c_t3):
            perfil_goda = "Acelerador"
        else:
            if c_t3 < c_t1:
                perfil_goda = "Desacelerador (Tendência)"
            elif c_t3 > c_t1:
                perfil_goda = "Acelerador (Tendência)"
            else:
                perfil_goda = "Flutuante (Misto)"

    for row in rows:
        row["goda_classification"] = perfil_goda

    summary = {
        "repetitions": int(total_reps),
        "total_time_s": round2(tempo_total_acumulado),
        "mean_cycle_duration_s": round2(mean_or_none(tempos_ciclo)),
        "mean_stand_time_s": round2(mean_or_none(tempos_levantar)),
        "mean_sit_time_s": round2(mean_or_none(tempos_sentar)),
        "mean_transition_to_stand_s": round2(mean_or_none([float(v) for v in trans_pe_list])) if trans_pe_list else None,
        "mean_transition_to_sit_s": round2(mean_or_none([float(v) for v in trans_sentado_list])) if trans_sentado_list else None,
        "mean_frequency_hz": round2(mean_or_none(hz_ciclos)),
        "cv_cycle_time_pct": round2(cv_tempo_total),
        "peak1_mean_deg": round2(mean_or_none(pico1_absoluto_list)),
        "peak2_mean_deg": round2(mean_or_none(pico2_absoluto_list)),
        "amp_flex_stand_mean_deg": round2(mean_or_none(amp_flex_levantar)),
        "amp_ext_stand_mean_deg": round2(mean_or_none(amp_ext_levantar)),
        "amp_flex_sit_mean_deg": round2(mean_or_none(amp_flex_sentar)),
        "amp_ext_sit_mean_deg": round2(mean_or_none(amp_ext_sentar)),
        "vel_flex_stand_mean_deg_s": round2(mean_or_none(vel_flex_levantar)),
        "vel_ext_stand_mean_deg_s": round2(mean_or_none(vel_ext_levantar)),
        "vel_flex_sit_mean_deg_s": round2(mean_or_none(vel_flex_sentar)),
        "vel_ext_sit_mean_deg_s": round2(mean_or_none(vel_ext_sentar)),
        "displacement_m": round2(h_deslocamento),
        "work_per_rep_j": round2(trabalho_por_ciclo),
        "total_work_j": round2(energia_total_acumulada),
        "mean_power_w": round2(mean_power_global),
        "rikli_jones_classification": status_norm,
        "z_score": z_val,
        "percentile": perc_val,
        "goda_classification": perfil_goda,
        "goda_counts": {"t0_10": int(c_t1), "t10_20": int(c_t2), "t20_30": int(c_t3)},
    }

    return rows, summary

# ==========================================================
# PIPELINE PRINCIPAL
# ==========================================================

def process_sl30s_csv(
    csv_path: str,
    sexo: Optional[str],
    idade: Optional[int],
    sujeito: str,
    *,
    include_plot_payload: bool = False,
) -> Dict[str, Any]:
    df_in, meta = load_app60_sl30s_csv(csv_path)

    time_s = df_in["time_s"].to_numpy(dtype=float)

    # Mesma reorganização do notebook:
    # aceleração -> [ax, az, ay] com inversão do eixo Y final
    acc_xyz = df_in[["ax", "az", "ay"]].to_numpy(dtype=float) * GRAVITY
    acc_xyz[:, 2] *= -1.0

    # giroscópio -> [gx, gz, gy] com inversão do eixo Y final
    gyr_xyz = df_in[["gx", "gz", "gy"]].to_numpy(dtype=float)
    gyr_xyz[:, 2] *= -1.0

    new_time, acc_interp, gyr_interp = interpolate_to_regular_grid(time_s, acc_xyz, gyr_xyz, fs=FS)
    acc_filt = butter_lowpass(acc_interp, ACC_CUTOFF_HZ, FS, order=BUTTER_ORDER)
    gyr_filt = butter_lowpass(gyr_interp, GYR_CUTOFF_HZ, FS, order=BUTTER_ORDER)

    q = madgwick_imu(acc_filt, gyr_filt, frequency=FS, beta=MADGWICK_BETA)
    euler_rad = np.asarray([q2euler_xyz(row) for row in q], dtype=float)
    deg_angles = np.degrees(euler_rad)
    deg_angles[:, 0] = deg_angles[:, 0] - np.mean(deg_angles[:, 0])
    signal_x = deg_angles[:, 0].astype(float)

    inicio_mov, fim_mov, peaks_mov, vales_mov, ciclos_para_plot, t_relativo = build_cycles(signal_x, new_time)

    if not ciclos_para_plot:
        raise ValueError("Nenhum ciclo completo detectado no SL30S.")

    df_transitions = compute_transition_times(new_time, signal_x, ciclos_para_plot)

    sex_norm = normalize_sex(sexo)
    body_mass_kg = infer_body_mass_kg(meta)
    height_cm = infer_height_cm(meta)
    bmi_kg_m2 = compute_bmi(body_mass_kg, height_cm)

    cycle_rows, summary = build_cycle_rows(
        new_time,
        t_relativo,
        signal_x,
        ciclos_para_plot,
        df_transitions,
        body_mass_kg,
        height_cm,
        sex_norm,
        int(idade) if idade is not None else None,
    )

    age_bin_label = age_to_bin_label(int(idade)) if idade is not None else "—"

    recorte_idx = np.arange(inicio_mov, fim_mov + 1, dtype=int)
    signal_cut = signal_x[recorte_idx]
    time_cut = t_relativo[recorte_idx]

    absolute_to_cut = {int(abs_i): int(rel_i) for rel_i, abs_i in enumerate(recorte_idx.tolist())}
    peaks_cut = [absolute_to_cut[int(i)] for i in peaks_mov if int(i) in absolute_to_cut]
    valleys_cut = [absolute_to_cut[int(i)] for i in vales_mov if int(i) in absolute_to_cut]

    metrics: Dict[str, Any] = {
        "analysis_version": "sl30s_worker_v2_notebook_port",
        "subject_code": str(sujeito),
        "sex": sex_norm,
        "age": int(idade) if idade is not None else None,
        "age_bin": age_bin_label,
        "body_mass_kg": round3(body_mass_kg),
        "height_cm": round1(height_cm),
        "bmi_kg_m2": bmi_kg_m2,
        "n_samples_raw": int(df_in.shape[0]),
        "n_samples_regular": int(new_time.size),
        "fs_hz": round3(FS),
        "analysis_start_s": round3(float(new_time[inicio_mov])),
        "analysis_end_s": round3(float(new_time[fim_mov])),
        "analysis_window_target_s": round3(WINDOW_SEC),
        "signal_name": "angle_x_deg",
        "signal_mean_deg": round3(float(np.mean(signal_cut))),
        "signal_sd_deg": round3(float(np.std(signal_cut))),
        "signal_min_deg": round3(float(np.min(signal_cut))),
        "signal_max_deg": round3(float(np.max(signal_cut))),
        "signal_amplitude_deg": round3(float(np.max(signal_cut) - np.min(signal_cut))),
        "peak_count": int(len(peaks_mov)),
        "valley_count": int(len(vales_mov)),
        **summary,
        "cycle_rows": cycle_rows,
    }

    result: Dict[str, Any] = {"metrics": metrics}

    if include_plot_payload:
        result["plot"] = {
            "signal_name": "angle_x_deg",
            "t_s": [float(v) for v in time_cut],
            "signal_deg": [float(v) for v in signal_cut],
            "peak_indices": [int(v) for v in peaks_cut],
            "valley_indices": [int(v) for v in valleys_cut],
            "start_index": 0,
            "cycles": [
                {
                    "id": int(c["id"]),
                    "start_index": int(absolute_to_cut.get(int(c["idx_global_start"]), 0)),
                    "end_index": int(absolute_to_cut.get(int(c["idx_global_end"]), 0)),
                    "peak_indices": [int(absolute_to_cut.get(int(p), 0)) for p in c["picos"]],
                    "valley_indices": [int(absolute_to_cut.get(int(v), 0)) for v in c["vales"]],
                    "duration_s": round3(c["duracao"]),
                }
                for c in ciclos_para_plot
            ],
        }

    return result