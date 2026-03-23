# worker.py
# -*- coding: utf-8 -*-

from __future__ import annotations

import os
import time
import tempfile
import traceback
from datetime import datetime, timezone, date
from typing import Any, Dict, Optional

from supabase import create_client, Client

from marcha_runtime import process_marcha_csv


# ===========================================================
# CONFIG
# ===========================================================

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVER_KEY = os.environ["SUPABASE_SERVER_KEY"]

CALIBRATOR_PATH = os.environ.get(
    "CALIBRATOR_PATH",
    "./calibrador_global_SP2VC_features_stack.joblib",
)

POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "10"))
TEST_TYPE = os.environ.get("TEST_TYPE", "MARCHA")
DEFAULT_BUCKET = os.environ.get("DEFAULT_BUCKET", "test-data")

# fallback se sexo/idade não estiverem salvos em lugar nenhum
DEFAULT_SEX = os.environ.get("DEFAULT_SEX", "M")
DEFAULT_AGE = int(os.environ.get("DEFAULT_AGE", "60"))

# lookup opcional na tabela de participantes
PARTICIPANTS_TABLE = os.environ.get("PARTICIPANTS_TABLE", "participants")
PARTICIPANT_ID_COLUMN = os.environ.get("PARTICIPANT_ID_COLUMN", "id")
PARTICIPANT_SEX_COLUMN = os.environ.get("PARTICIPANT_SEX_COLUMN", "sex")
PARTICIPANT_AGE_COLUMN = os.environ.get("PARTICIPANT_AGE_COLUMN", "age")
PARTICIPANT_BIRTHDATE_COLUMN = os.environ.get("PARTICIPANT_BIRTHDATE_COLUMN", "birth_date")
PARTICIPANT_NAME_COLUMN = os.environ.get("PARTICIPANT_NAME_COLUMN", "name")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVER_KEY)


# ===========================================================
# UTILS
# ===========================================================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def safe_error_text(err: Exception) -> str:
    text = f"{type(err).__name__}: {str(err)}"
    return text[:4000]


def normalize_sex(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip().upper()
    if s in {"M", "MALE", "MASC", "MASCULINO"}:
        return "M"
    if s in {"F", "FEMALE", "FEM", "FEMININO"}:
        return "F"
    return None


def parse_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(float(value))
    except Exception:
        return None


def age_from_birthdate(value: Any) -> Optional[int]:
    if not value:
        return None

    try:
        if isinstance(value, date):
            birth = value
        else:
            birth = date.fromisoformat(str(value)[:10])

        today = datetime.now().date()
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        return int(age)
    except Exception:
        return None


def first_non_null(d: Dict[str, Any], keys: list[str]) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


# ===========================================================
# PARTICIPANT META
# ===========================================================

def fetch_participant_row(participant_id: str) -> Optional[Dict[str, Any]]:
    """
    Busca dados do participante se a tabela existir.
    Se falhar, só retorna None e segue a vida.
    """
    try:
        resp = (
            supabase.table(PARTICIPANTS_TABLE)
            .select("*")
            .eq(PARTICIPANT_ID_COLUMN, participant_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None
    except Exception as e:
        log(f"Lookup de participante ignorado: {e}")
        return None


def resolve_subject_meta(session_row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Resolve sexo, idade e sujeito sem quebrar caso o banco ainda esteja incompleto.
    Ordem:
    1. campos na própria test_sessions
    2. tabela participants (se existir)
    3. fallback por env
    """
    participant_id = str(session_row["participant_id"])
    participant_row = fetch_participant_row(participant_id)

    session_sex = normalize_sex(first_non_null(session_row, ["sex", "sexo", "participant_sex"]))
    session_age = parse_int(first_non_null(session_row, ["age", "idade", "participant_age"]))
    session_name = first_non_null(session_row, ["participant_name", "name", "sujeito", "subject_code"])

    participant_sex = None
    participant_age = None
    participant_name = None

    if participant_row:
        participant_sex = normalize_sex(participant_row.get(PARTICIPANT_SEX_COLUMN))
        participant_age = parse_int(participant_row.get(PARTICIPANT_AGE_COLUMN))
        if participant_age is None:
            participant_age = age_from_birthdate(participant_row.get(PARTICIPANT_BIRTHDATE_COLUMN))
        participant_name = participant_row.get(PARTICIPANT_NAME_COLUMN)

    sex = session_sex or participant_sex or DEFAULT_SEX
    age = session_age or participant_age or DEFAULT_AGE

    # sujeito é só um identificador textual para a rotina
    # pode ser nome, subject_code, ou prefixo do participant_id
    sujeito = session_name or participant_name or f"{participant_id[:8]}_S{session_row['session_number']}"

    return {
        "sexo": sex,
        "idade": int(age),
        "sujeito": str(sujeito),
    }


# ===========================================================
# STORAGE / DB
# ===========================================================

def download_raw_csv(bucket: str, path: str) -> bytes:
    return supabase.storage.from_(bucket).download(path)


def claim_next_session() -> Optional[Dict[str, Any]]:
    """
    Pega a próxima sessão pendente.
    Assumindo 1 worker rodando.
    """
    resp = (
        supabase.table("test_sessions")
        .select("*")
        .eq("test_type", TEST_TYPE)
        .eq("processing_status", "pending")
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return None

    row = rows[0]

    (
        supabase.table("test_sessions")
        .update({
            "processing_status": "processing",
            "processing_error": None,
        })
        .eq("id", row["id"])
        .execute()
    )

    row["processing_status"] = "processing"
    row["processing_error"] = None
    return row


def mark_done(session_id: str) -> None:
    (
        supabase.table("test_sessions")
        .update({
            "processing_status": "done",
            "processed_at": now_iso(),
            "processing_error": None,
        })
        .eq("id", session_id)
        .execute()
    )


def mark_error(session_id: str, err: Exception) -> None:
    (
        supabase.table("test_sessions")
        .update({
            "processing_status": "error",
            "processing_error": safe_error_text(err),
        })
        .eq("id", session_id)
        .execute()
    )


def upsert_result(session_row: Dict[str, Any], metrics: Dict[str, Any]) -> None:
    payload = {
        "test_session_id": session_row["id"],
        "participant_id": session_row["participant_id"],
        "test_type": session_row["test_type"],
        "session_number": session_row["session_number"],
        "metrics_json": metrics,
        "updated_at": now_iso(),
    }

    (
        supabase.table("test_session_results")
        .upsert(payload, on_conflict="test_session_id")
        .execute()
    )


# ===========================================================
# PROCESSAMENTO
# ===========================================================

def process_one(session_row: Dict[str, Any]) -> None:
    bucket = session_row.get("raw_bucket") or DEFAULT_BUCKET
    raw_path = session_row["raw_file_path"]

    log(f"Baixando CSV do bucket={bucket} path={raw_path}")
    raw_bytes = download_raw_csv(bucket, raw_path)

    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, "raw.csv")
        with open(csv_path, "wb") as f:
            f.write(raw_bytes)

        meta = resolve_subject_meta(session_row)
        log(f"Meta resolvida | sexo={meta['sexo']} idade={meta['idade']} sujeito={meta['sujeito']}")

        result = process_marcha_csv(
            csv_path=csv_path,
            calibrator_path=CALIBRATOR_PATH,
            sexo=meta["sexo"],
            idade=meta["idade"],
            sujeito=meta["sujeito"],
            include_plot_payload=False,  # você disse que por enquanto quer só métricas
        )

        metrics = result["metrics"]

        log(f"Métricas prontas: {metrics}")
        upsert_result(session_row, metrics)
        mark_done(session_row["id"])


# ===========================================================
# MAIN LOOP
# ===========================================================

def main() -> None:
    log("Worker da MARCHA iniciado.")

    while True:
        row: Optional[Dict[str, Any]] = None
        try:
            row = claim_next_session()

            if row is None:
                time.sleep(POLL_SECONDS)
                continue

            log(
                f"Processando sessão id={row['id']} "
                f"participant_id={row['participant_id']} "
                f"session={row['session_number']}"
            )

            process_one(row)

            log(f"OK sessão {row['id']} finalizada.")
            time.sleep(1)

        except Exception as e:
            log("ERRO no worker:")
            traceback.print_exc()

            if row and row.get("id"):
                try:
                    mark_error(row["id"], e)
                except Exception:
                    log("Falha ao marcar sessão como error.")
                    traceback.print_exc()

            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()