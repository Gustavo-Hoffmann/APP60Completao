# -*- coding: utf-8 -*-
"""Lê o raw.json de atividade física/sedentarismo e devolve métricas para o worker."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_int(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(float(value))
    except Exception:
        return None


def as_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def process_act_sedentary_file(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    payload = as_dict(raw)
    questionnaire = as_dict(payload.get("questionnaire"))
    summary = as_dict(questionnaire.get("summary"))

    metrics: Dict[str, Any] = {
        "schema_version": as_int(payload.get("schema_version")),
        "summary": summary,
        "answers": as_dict(questionnaire.get("answers")),
        "meta": as_dict(questionnaire.get("meta")),
        "performed_at": payload.get("performed_at"),
        "session_label": payload.get("session_label"),
        "platform": payload.get("platform"),
        "sampling_hz": as_float(payload.get("sampling_hz")),
        "participant_name": payload.get("participant_name"),
    }

    return {"metrics": metrics}
