# -*- coding: utf-8 -*-
"""
ivcf20_runtime.py

Lê o raw.json do IVCF-20 vindo do app/storage e devolve um payload
compatível com o worker para gravar em test_session_results.metrics_json.
"""

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


def normalize_ivcf_label(label: Any, key: Any = None) -> Optional[str]:
    text = str(label or "").strip()
    if text:
        low = text.lower()
        if low == "robusto":
            return "Robusto"
        if low in {"pré-frágil", "pre-frágil", "pre-fragil", "pré-fragil"}:
            return "Pré-Frágil"
        if low in {"frágil", "fragil"}:
            return "Frágil"
        return text

    norm_key = str(key or "").strip().lower()
    if norm_key == "robusto":
        return "Robusto"
    if norm_key in {"pre_fragil", "pre-fragil", "pré-frágil", "pré_fragil"}:
        return "Pré-Frágil"
    if norm_key == "fragil":
        return "Frágil"

    return None


def extract_block_scores(questionnaire: Dict[str, Any]) -> List[Dict[str, Any]]:
    blocks: List[Dict[str, Any]] = []

    raw_blocks = as_list(questionnaire.get("block_scores"))
    if raw_blocks:
        for item in raw_blocks:
            row = as_dict(item)
            if not row:
                continue

            blocks.append(
                {
                    "key": str(row.get("key") or "").strip() or None,
                    "label": str(row.get("label") or row.get("key") or "").strip() or None,
                    "score": as_int(row.get("score")),
                    "max_score": as_int(row.get("max_score")),
                }
            )
        return blocks

    categories = as_dict(questionnaire.get("categories"))
    for key, value in categories.items():
        row = as_dict(value)
        blocks.append(
            {
                "key": str(row.get("key") or key).strip() or None,
                "label": str(row.get("label") or key).strip() or None,
                "score": as_int(row.get("score")),
                "max_score": as_int(row.get("max_score")),
            }
        )

    return blocks


def build_blocks_map(block_scores: List[Dict[str, Any]]) -> Dict[str, Optional[int]]:
    out: Dict[str, Optional[int]] = {}
    for block in block_scores:
        label = str(block.get("label") or block.get("key") or "").strip()
        if not label:
            continue
        out[label] = as_int(block.get("score"))
    return out


def process_ivcf20_file(file_path: str) -> Dict[str, Any]:
    with open(file_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    payload = as_dict(raw)
    questionnaire = as_dict(payload.get("questionnaire"))
    classification = as_dict(questionnaire.get("classification"))
    block_scores = extract_block_scores(questionnaire)

    metrics: Dict[str, Any] = {
        "schema_version": as_int(payload.get("schema_version")),
        "score_total": as_int(questionnaire.get("score_total")),
        "classification_label": normalize_ivcf_label(
            classification.get("label"),
            classification.get("key"),
        ),
        "classification_key": str(classification.get("key") or "").strip() or None,
        "block_scores": block_scores,
        "blocks_map": build_blocks_map(block_scores),
        "categories": as_dict(questionnaire.get("categories")),
        "answers": as_dict(questionnaire.get("answers")),
        "meta": as_dict(questionnaire.get("meta")),
        "performed_at": payload.get("performed_at"),
        "session_label": payload.get("session_label"),
        "platform": payload.get("platform"),
        "sampling_hz": as_float(payload.get("sampling_hz")),
        "participant_name": payload.get("participant_name"),
    }

    return {"metrics": metrics}