# -*- coding: utf-8 -*-
"""Lê o raw.json do FES-I e devolve métricas para o worker."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


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


def process_fesi_file(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    payload = as_dict(raw)
    questionnaire = as_dict(payload.get("questionnaire"))
    classification = as_dict(questionnaire.get("classification"))
    item_scores = as_list(questionnaire.get("item_scores"))

    metrics: Dict[str, Any] = {
        "schema_version": as_int(payload.get("schema_version")),
        "score_total": as_int(questionnaire.get("score_total")),
        "mean_score": as_float(questionnaire.get("mean_score")),
        "classification_label": str(classification.get("label") or "").strip() or None,
        "classification_key": str(classification.get("key") or "").strip() or None,
        "item_scores": item_scores,
        "answers": as_dict(questionnaire.get("answers")),
        "meta": as_dict(questionnaire.get("meta")),
        "performed_at": payload.get("performed_at"),
        "session_label": payload.get("session_label"),
        "platform": payload.get("platform"),
        "sampling_hz": as_float(payload.get("sampling_hz")),
        "participant_name": payload.get("participant_name"),
    }

    return {"metrics": metrics}
