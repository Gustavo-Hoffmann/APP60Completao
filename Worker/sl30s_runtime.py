
# -*- coding: utf-8 -*-
"""
sl30s_runtime.py

Runtime do teste Sentar e Levantar (SL30S/30STS).

Portado a partir do notebook "30STS - APP 01 GU CSV" para uso no worker:
- leitura robusta do CSV bruto do app60
- interpolação ACC/GYR em 60 Hz
- filtro Butterworth igual ao notebook
- orientação via Madgwick IMU-only
- detecção de ciclos no ângulo X (vale-pico-vale-pico-vale)
- saída com métricas + payload do gráfico em memória
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
GYR_CUTOFF_HZ = 10.0
BUTTER_ORDER = 4
PEAK_MIN_DISTANCE = 30
PEAK_THRESHOLD_DEG = 5.0
MADGWICK_BETA = 0.15
WINDOW_SEC = 30.5
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


def round1(value: Any) -> Optional[float]:
    try:
        v = float(value)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return round(v, 1)


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


def load_app60_sl30s_csv(file_path: str) -> Tuple[pd.DataFrame, Dict[str, str]]:
    meta = parse_metadata_from_csv(file_path)
    df = pd.read_csv(file_path, comment="#")

    required_signals = ["ax", "ay", "az", "gx", "gy", "gz"]
    missing = [c for c in required_signals if c not in df.columns]
    if missing:
        raise ValueError(f"CSV bruto do SL30S sem colunas obrigatórias: {missing}")

    if "acc_t_ms" in df.columns:
        acc_t_ms = pd.to_numeric(df["acc_t_ms"], errors="coerce")
    elif "row_t_ms" in df.columns:
        acc_t_ms = pd.to_numeric(df["row_t_ms"], errors="coerce")
    else:
        raise ValueError("CSV bruto do SL30S sem coluna temporal para acelerômetro (acc_t_ms ou row_t_ms).")

    if "gyro_t_ms" in df.columns:
        gyr_t_ms = pd.to_numeric(df["gyro_t_ms"], errors="coerce")
    elif "row_t_ms" in df.columns:
        gyr_t_ms = pd.to_numeric(df["row_t_ms"], errors="coerce")
    else:
        raise ValueError("CSV bruto do SL30S sem coluna temporal para giroscópio (gyro_t_ms ou row_t_ms).")

    out = pd.DataFrame({
        "acc_time_s": acc_t_ms / 1000.0,
        "gyr_time_s": gyr_t_ms / 1000.0,
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
        .dropna(subset=["acc_time_s", "gyr_time_s", "ax", "ay", "az", "gx", "gy", "gz"])
        .reset_index(drop=True)
    )

    if out.shape[0] < 10:
        raise ValueError("CSV bruto ficou curto demais após limpeza do SL30S.")

    return out, meta


def normalize_timebase(time_s: np.ndarray, signal_xyz: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    time_s = np.asarray(time_s, dtype=float)
    signal_xyz = np.asarray(signal_xyz, dtype=float)

    time_diff = np.diff(time_s)
    time_diff = np.insert(time_diff, 0, 0.0)
    time_cumsum = np.cumsum(time_diff)
    time_cumsum = time_cumsum - time_cumsum[0]

    if np.all(np.diff(time_cumsum) > 0):
        return time_cumsum.astype(float), signal_xyz.astype(float)

    unique_idx = np.unique(time_cumsum, return_index=True)[1]
    time_cumsum = time_cumsum[unique_idx]
    signal_xyz = signal_xyz[unique_idx]
    order = np.argsort(time_cumsum)
    return time_cumsum[order].astype(float), signal_xyz[order].astype(float)


def interpolate_to_regular_grid(
    acc_time_s: np.ndarray,
    acc_xyz: np.ndarray,
    gyr_time_s: np.ndarray,
    gyr_xyz: np.ndarray,
    *,
    fs: float = FS,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    dt = 1.0 / fs

    ta, acc_clean = normalize_timebase(acc_time_s, acc_xyz)
    tg, gyr_clean = normalize_timebase(gyr_time_s, gyr_xyz)

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


def butter_lowpass(data: np.ndarray, cutoff_hz: float, fs: float, order: int = BUTTER_ORDER) -> np.ndarray:
    nyq = 0.5 * fs
    b, a = butter(order, cutoff_hz / nyq, btype="low", analog=False)
    return filtfilt(b, a, data, axis=0)


def madgwick_imu(
    acc: np.ndarray,
    gyr: np.ndarray,
    *,
    frequency: float = FS,
    beta: float = MADGWICK_BETA,
) -> np.ndarray:
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
        q[i] = q[i - 1] if q_new_norm <= 0.0 else (q_new / q_new_norm)

    return q


def q2euler_xyz(q: np.ndarray) -> np.ndarray:
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


def detect_events(signal_x: np.ndarray, time_s: np.ndarray) -> Tuple[int, int, np.ndarray, np.ndarray]:
    media = float(np.mean(signal_x))

    peaks, _ = find_peaks(signal_x, distance=PEAK_MIN_DISTANCE)
    peaks = np.asarray([int(p) for p in peaks if signal_x[p] > (media + PEAK_THRESHOLD_DEG)], dtype=int)

    valleys, _ = find_peaks(-signal_x, distance=PEAK_MIN_DISTANCE)
    valleys = np.asarray(
        [int(v) for v in valleys if signal_x[v] < (media - PEAK_THRESHOLD_DEG) and v < len(signal_x) - 1],
        dtype=int,
    )

    inicio_mov = 0
    found_start = False
    for i in range(max(0, len(valleys) - 2)):
        v1 = int(valleys[i])
        v2 = int(valleys[i + 1])
        has_peak_between = any(v1 < int(p) < v2 for p in peaks.tolist())
        if has_peak_between:
            inicio_mov = v1
            found_start = True
            break

    if not found_start:
        inicio_mov = int(valleys[0]) if valleys.size else 0

    tempo_inicio = float(time_s[inicio_mov])
    tempo_fim = tempo_inicio + WINDOW_SEC
    fim_mov = int(np.argmin(np.abs(time_s - tempo_fim)))

    peaks_mov = np.asarray([int(p) for p in peaks if inicio_mov <= int(p) <= fim_mov], dtype=int)
    valleys_mov = np.asarray([int(v) for v in valleys if inicio_mov <= int(v) <= fim_mov], dtype=int)

    if peaks_mov.size == 0 or valleys_mov.size == 0:
        raise ValueError("Não foi possível detectar picos/vales suficientes no SL30S.")

    valleys_corr = [int(valleys_mov[0])]
    for i in range(len(peaks_mov) - 1):
        start = int(peaks_mov[i])
        end = int(peaks_mov[i + 1])
        if end > start + 1:
            seq = signal_x[start:end]
            if seq.size > 0:
                idx_min = int(np.argmin(seq) + start)
                if idx_min != valleys_corr[-1]:
                    valleys_corr.append(idx_min)

    if len(peaks_mov) > 0 and int(peaks_mov[-1]) + 1 < len(signal_x):
        seq = signal_x[int(peaks_mov[-1]) + 1 : fim_mov + 1]
        if seq.size > 0:
            idx_min_final = int(np.argmin(seq) + int(peaks_mov[-1]) + 1)
            if (
                idx_min_final < len(signal_x) - 1
                and idx_min_final > 0
                and signal_x[idx_min_final] < signal_x[idx_min_final - 1]
                and signal_x[idx_min_final] < signal_x[idx_min_final + 1]
            ):
                valleys_corr.append(idx_min_final)

    valleys_mov = np.asarray(sorted(set(valleys_corr)), dtype=int)

    return inicio_mov, fim_mov, peaks_mov, valleys_mov


def build_cycles_from_events(peaks: np.ndarray, valleys: np.ndarray, time_rel_s: np.ndarray) -> List[Dict[str, Any]]:
    ciclos: List[Dict[str, Any]] = []
    peaks_list = [int(v) for v in peaks.tolist()]
    valleys_list = [int(v) for v in valleys.tolist()]

    i_vale = 0
    i_pico = 0

    while True:
        if i_vale + 2 >= len(valleys_list) or i_pico + 1 >= len(peaks_list):
            break

        v1 = valleys_list[i_vale]

        while i_pico < len(peaks_list) and peaks_list[i_pico] < v1:
            i_pico += 1
        if i_pico >= len(peaks_list):
            break
        p1 = peaks_list[i_pico]

        i_vale2 = i_vale + 1
        while i_vale2 < len(valleys_list) and valleys_list[i_vale2] < p1:
            i_vale2 += 1
        if i_vale2 >= len(valleys_list):
            break
        v2 = valleys_list[i_vale2]

        i_pico2 = i_pico + 1
        while i_pico2 < len(peaks_list) and peaks_list[i_pico2] < v2:
            i_pico2 += 1
        if i_pico2 >= len(peaks_list):
            break
        p2 = peaks_list[i_pico2]

        i_vale3 = i_vale2 + 1
        while i_vale3 < len(valleys_list) and valleys_list[i_vale3] < p2:
            i_vale3 += 1
        if i_vale3 >= len(valleys_list):
            break
        v3 = valleys_list[i_vale3]

        ciclos.append({
            "id": len(ciclos) + 1,
            "vales": [int(v1), int(v2), int(v3)],
            "picos": [int(p1), int(p2)],
            "inicio": int(v1),
            "fim": int(v3),
            "duracao": float(time_rel_s[v3] - time_rel_s[v1]),
        })

        i_vale = i_vale3
        i_pico = i_pico2

    return ciclos


def compute_transition_times(time_s: np.ndarray, ciclos: List[Dict[str, Any]]) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []
    for i, ciclo in enumerate(ciclos):
        v1, p1, v2, p2, _v3 = (
            int(ciclo["vales"][0]),
            int(ciclo["picos"][0]),
            int(ciclo["vales"][1]),
            int(ciclo["picos"][1]),
            int(ciclo["vales"][2]),
        )
        rows.append({
            "Ciclo": int(i + 1),
            "Transição Em Pé": round2(float(time_s[p1] - time_s[v1])),
            "Transição Sentado": round2(float(time_s[p2] - time_s[v2])),
        })
    return pd.DataFrame(rows, columns=["Ciclo", "Transição Em Pé", "Transição Sentado"])


def build_cycle_rows(
    time_s: np.ndarray,
    time_rel_s: np.ndarray,
    signal_x: np.ndarray,
    ciclos: List[Dict[str, Any]],
    df_transitions: pd.DataFrame,
    body_mass_kg: float,
    height_cm: float,
    sexo: Optional[str],
    idade: Optional[int],
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    trans_stand = df_transitions["Transição Em Pé"].tolist() if not df_transitions.empty else []
    trans_sit = df_transitions["Transição Sentado"].tolist() if not df_transitions.empty else []

    tempos_ciclo: List[float] = []
    tempos_levantar: List[float] = []
    tempos_sentar: List[float] = []
    pico1_list: List[float] = []
    pico2_list: List[float] = []
    pico1_t_rel_list: List[float] = []
    pico2_t_rel_list: List[float] = []
    amp_flex_levantar: List[float] = []
    amp_ext_levantar: List[float] = []
    amp_flex_sentar: List[float] = []
    amp_ext_sentar: List[float] = []
    vel_flex_levantar: List[float] = []
    vel_ext_levantar: List[float] = []
    vel_flex_sentar: List[float] = []
    vel_ext_sentar: List[float] = []
    rows: List[Dict[str, Any]] = []

    height_m = float(height_cm) / 100.0
    h_sentado = 0.53 * height_m
    h_deslocamento = h_sentado - CHAIR_HEIGHT_M
    if h_deslocamento <= 0:
        h_deslocamento = 0.1

    energia_por_ciclo = body_mass_kg * BODY_MASS_FACTOR * GRAVITY * h_deslocamento

    for i, ciclo in enumerate(ciclos):
        idx_v1 = int(ciclo["vales"][0])
        idx_p1 = int(ciclo["picos"][0])
        idx_v2 = int(ciclo["vales"][1])
        idx_p2 = int(ciclo["picos"][1])
        idx_v3 = int(ciclo["vales"][2])

        t_v1 = float(time_s[idx_v1])
        t_v2 = float(time_s[idx_v2])
        t_v3 = float(time_s[idx_v3])
        t_p1 = float(time_s[idx_p1])
        t_p2 = float(time_s[idx_p2])

        tempo_total = t_v3 - t_v1
        tempo_levantar = t_v2 - t_v1
        tempo_sentar = t_v3 - t_v2

        tempos_ciclo.append(tempo_total)
        tempos_levantar.append(tempo_levantar)
        tempos_sentar.append(tempo_sentar)

        pico1 = float(signal_x[idx_p1])
        pico2 = float(signal_x[idx_p2])
        pico1_list.append(pico1)
        pico2_list.append(pico2)
        pico1_t_rel_list.append(float(time_rel_s[idx_p1]))
        pico2_t_rel_list.append(float(time_rel_s[idx_p2]))

        flex_lev = abs(float(signal_x[idx_v1] - signal_x[idx_p1]))
        ext_lev = abs(float(signal_x[idx_p1] - signal_x[idx_v2]))
        flex_sen = abs(float(signal_x[idx_v2] - signal_x[idx_p2]))
        ext_sen = abs(float(signal_x[idx_p2] - signal_x[idx_v3]))

        amp_flex_levantar.append(flex_lev)
        amp_ext_levantar.append(ext_lev)
        amp_flex_sentar.append(flex_sen)
        amp_ext_sentar.append(ext_sen)

        vel_fl_lev = flex_lev / tempo_levantar if tempo_levantar > 0 else 0.0
        vel_ex_lev = ext_lev / tempo_levantar if tempo_levantar > 0 else 0.0
        vel_fl_sen = flex_sen / tempo_sentar if tempo_sentar > 0 else 0.0
        vel_ex_sen = ext_sen / tempo_sentar if tempo_sentar > 0 else 0.0

        vel_flex_levantar.append(vel_fl_lev)
        vel_ext_levantar.append(vel_ex_lev)
        vel_flex_sentar.append(vel_fl_sen)
        vel_ext_sentar.append(vel_ex_sen)

        power_cycle = energia_por_ciclo / tempo_total if tempo_total > 0 else 0.0

        rows.append({
            "cycle": int(i + 1),
            "time_total_s": round2(tempo_total),
            "time_stand_s": round2(tempo_levantar),
            "time_sit_s": round2(tempo_sentar),
            "transition_to_stand_s": round2(trans_stand[i]) if i < len(trans_stand) else None,
            "transition_to_sit_s": round2(trans_sit[i]) if i < len(trans_sit) else None,
            "frequency_hz": round2((1.0 / tempo_total) if tempo_total > 0 else 0.0),
            "peak1_deg": round2(pico1),
            "peak1_time_rel_s": round3(time_rel_s[idx_p1]),
            "peak2_deg": round2(pico2),
            "peak2_time_rel_s": round3(time_rel_s[idx_p2]),
            "amp_flex_stand_deg": round2(flex_lev),
            "amp_ext_stand_deg": round2(ext_lev),
            "amp_flex_sit_deg": round2(flex_sen),
            "amp_ext_sit_deg": round2(ext_sen),
            "vel_flex_stand_deg_s": round2(vel_fl_lev),
            "vel_ext_stand_deg_s": round2(vel_ex_lev),
            "vel_flex_sit_deg_s": round2(vel_fl_sen),
            "vel_ext_sit_deg_s": round2(vel_ex_sen),
            "cycle_start_t_rel_s": round3(time_rel_s[idx_v1]),
            "cycle_end_t_rel_s": round3(time_rel_s[idx_v3]),
            "valley_indices": [idx_v1, idx_v2, idx_v3],
            "peak_indices": [idx_p1, idx_p2],
            "displacement_m": round3(h_deslocamento),
            "work_j": round2(energia_por_ciclo),
            "power_w": round2(power_cycle),
        })

    hz_ciclos = [(1.0 / t) if t > 0 else 0.0 for t in tempos_ciclo]
    cv_tempo_total = (
        (float(np.std(tempos_ciclo, ddof=1)) / float(np.mean(tempos_ciclo)) * 100.0)
        if len(tempos_ciclo) > 1 and float(np.mean(tempos_ciclo)) > 0.0
        else 0.0
    )

    tempo_total_acumulado = sum_or_zero(tempos_ciclo)
    energia_total = energia_por_ciclo * len(ciclos)
    mean_power_global = (energia_total / tempo_total_acumulado) if tempo_total_acumulado > 0 else 0.0
    mean_power_relative = (mean_power_global / body_mass_kg) if body_mass_kg > 0 else 0.0

    total_reps = len(ciclos)
    status_norm, z_val, perc_val = classify_30sts(sexo, idade, total_reps)

    c_t1 = c_t2 = c_t3 = 0
    for ciclo in ciclos:
        idx_fim = int(ciclo["vales"][2])
        tempo_fim_ciclo = float(time_rel_s[idx_fim])
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
        row["cv_cycle_time_pct"] = round2(cv_tempo_total)
        row["rikli_jones_classification"] = status_norm
        row["z_score"] = z_val
        row["percentile"] = perc_val
        row["goda_classification"] = perfil_goda

    summary = {
        "repetitions": int(total_reps),
        "total_time_s": round2(tempo_total_acumulado),
        "mean_cycle_duration_s": round2(mean_or_none(tempos_ciclo)),
        "mean_stand_time_s": round2(mean_or_none(tempos_levantar)),
        "mean_sit_time_s": round2(mean_or_none(tempos_sentar)),
        "mean_transition_to_stand_s": round2(mean_or_none(trans_stand)) if trans_stand else None,
        "mean_transition_to_sit_s": round2(mean_or_none(trans_sit)) if trans_sit else None,
        "mean_frequency_hz": round2(mean_or_none(hz_ciclos)),
        "cv_cycle_time_pct": round2(cv_tempo_total),
        "peak1_mean_deg": round2(mean_or_none(pico1_list)),
        "peak2_mean_deg": round2(mean_or_none(pico2_list)),
        "peak1_mean_time_rel_s": round2(mean_or_none(pico1_t_rel_list)),
        "peak2_mean_time_rel_s": round2(mean_or_none(pico2_t_rel_list)),
        "amp_flex_stand_mean_deg": round2(mean_or_none(amp_flex_levantar)),
        "amp_ext_stand_mean_deg": round2(mean_or_none(amp_ext_levantar)),
        "amp_flex_sit_mean_deg": round2(mean_or_none(amp_flex_sentar)),
        "amp_ext_sit_mean_deg": round2(mean_or_none(amp_ext_sentar)),
        "vel_flex_stand_mean_deg_s": round2(mean_or_none(vel_flex_levantar)),
        "vel_ext_stand_mean_deg_s": round2(mean_or_none(vel_ext_levantar)),
        "vel_flex_sit_mean_deg_s": round2(mean_or_none(vel_flex_sentar)),
        "vel_ext_sit_mean_deg_s": round2(mean_or_none(vel_ext_sentar)),
        "displacement_m": round3(h_deslocamento),
        "work_per_rep_j": round2(energia_por_ciclo),
        "total_work_j": round2(energia_total),
        "mean_power_w": round2(mean_power_global),
        "mean_power_relative_w_kg": round3(mean_power_relative),
        "rikli_jones_classification": status_norm,
        "z_score": z_val,
        "percentile": perc_val,
        "goda_classification": perfil_goda,
        "goda_counts": {"t0_10": int(c_t1), "t10_20": int(c_t2), "t20_30": int(c_t3)},
    }

    return rows, summary


def process_sl30s_csv(
    csv_path: str,
    sexo: Optional[str],
    idade: Optional[int],
    sujeito: str,
    *,
    include_plot_payload: bool = False,
) -> Dict[str, Any]:
    df_in, meta = load_app60_sl30s_csv(csv_path)

    acc_time_s = df_in["acc_time_s"].to_numpy(dtype=float)
    gyr_time_s = df_in["gyr_time_s"].to_numpy(dtype=float)

    acc_xyz = df_in[["ax", "az", "ay"]].to_numpy(dtype=float) * GRAVITY
    acc_xyz[:, 2] *= -1.0

    gyr_xyz = df_in[["gx", "gz", "gy"]].to_numpy(dtype=float)
    gyr_xyz[:, 2] *= -1.0

    new_time, acc_interp, gyr_interp = interpolate_to_regular_grid(
        acc_time_s,
        acc_xyz,
        gyr_time_s,
        gyr_xyz,
        fs=FS,
    )

    acc_filt = butter_lowpass(acc_interp, ACC_CUTOFF_HZ, FS, order=BUTTER_ORDER)
    gyr_filt = butter_lowpass(gyr_interp, GYR_CUTOFF_HZ, FS, order=BUTTER_ORDER)

    if acc_filt.shape[0] != gyr_filt.shape[0]:
        min_len = min(acc_filt.shape[0], gyr_filt.shape[0])
        acc_filt = acc_filt[:min_len]
        gyr_filt = gyr_filt[:min_len]
        new_time = new_time[:min_len]

    q = madgwick_imu(acc_filt, gyr_filt, frequency=FS, beta=MADGWICK_BETA)
    euler_rad = np.asarray([q2euler_xyz(row) for row in q], dtype=float)
    deg_angles = np.degrees(euler_rad)
    deg_angles[:, 0] = deg_angles[:, 0] - np.mean(deg_angles[:, 0])
    signal_x = deg_angles[:, 0].astype(float)

    inicio_mov, fim_mov, peaks_mov, valleys_mov = detect_events(signal_x, new_time)
    time_rel_s = new_time - new_time[inicio_mov]
    ciclos = build_cycles_from_events(peaks_mov, valleys_mov, time_rel_s)

    if not ciclos:
        raise ValueError("Nenhum ciclo completo detectado no SL30S.")

    df_transitions = compute_transition_times(new_time, ciclos)

    sex_norm = normalize_sex(sexo)
    body_mass_kg = infer_body_mass_kg(meta)
    height_cm = infer_height_cm(meta)
    bmi_kg_m2 = compute_bmi(body_mass_kg, height_cm)

    cycle_rows, summary = build_cycle_rows(
        new_time,
        time_rel_s,
        signal_x,
        ciclos,
        df_transitions,
        body_mass_kg,
        height_cm,
        sex_norm,
        int(idade) if idade is not None else None,
    )

    age_bin_label = age_to_bin_label(int(idade)) if idade is not None else "—"

    recorte_idx = np.arange(inicio_mov, fim_mov + 1, dtype=int)
    signal_cut = signal_x[recorte_idx]
    time_cut = time_rel_s[recorte_idx]

    absolute_to_cut = {int(abs_i): int(rel_i) for rel_i, abs_i in enumerate(recorte_idx.tolist())}
    peaks_cut = [absolute_to_cut[int(i)] for i in peaks_mov if int(i) in absolute_to_cut]
    valleys_cut = [absolute_to_cut[int(i)] for i in valleys_mov if int(i) in absolute_to_cut]

    metrics: Dict[str, Any] = {
        "analysis_version": "sl30s_worker_v3_notebook_aligned",
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
        "analysis_window_actual_s": round3(float(new_time[fim_mov] - new_time[inicio_mov])),
        "signal_name": "angle_x_deg",
        "signal_mean_deg": round3(float(np.mean(signal_cut))),
        "signal_sd_deg": round3(float(np.std(signal_cut))),
        "signal_min_deg": round3(float(np.min(signal_cut))),
        "signal_max_deg": round3(float(np.max(signal_cut))),
        "signal_amplitude_deg": round3(float(np.max(signal_cut) - np.min(signal_cut))),
        "peak_count": int(len(peaks_mov)),
        "valley_count": int(len(valleys_mov)),
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
            "end_index": int(len(time_cut) - 1),
            "analysis_start_t_s": 0.0,
            "analysis_end_t_s": round3(float(time_cut[-1])) if len(time_cut) else 0.0,
            "cycles": [
                {
                    "id": int(c["id"]),
                    "start_index": int(absolute_to_cut[int(c["inicio"])]),
                    "end_index": int(absolute_to_cut[int(c["fim"])]),
                    "peak_indices": [int(absolute_to_cut[int(p)]) for p in c["picos"]],
                    "valley_indices": [int(absolute_to_cut[int(v)]) for v in c["vales"]],
                    "duration_s": round3(float(c["duracao"])),
                }
                for c in ciclos
                if int(c["inicio"]) in absolute_to_cut and int(c["fim"]) in absolute_to_cut
            ],
        }

    return result
