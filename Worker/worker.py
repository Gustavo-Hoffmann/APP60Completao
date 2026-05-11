# worker.py
# -*- coding: utf-8 -*-
# Processa fila em RDS (tabela collections) e lê arquivos brutos no S3.

from __future__ import annotations

import os
import time
import tempfile
import traceback
from datetime import datetime, timezone, date
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Json

from marcha_runtime import process_marcha_csv
from sl30s_runtime import process_sl30s_csv
from ivcf20_runtime import process_ivcf20_file
from fesi_runtime import process_fesi_file
from act_sedentary_runtime import process_act_sedentary_file


# ===========================================================
# CONFIG
# ===========================================================

DATABASE_URL = os.environ["DATABASE_URL"]
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

CALIBRATOR_PATH = os.environ.get(
    "CALIBRATOR_PATH",
    "./calibrador_global_SP2VC_features_stack.joblib",
)

CALIBRATOR_S3_BUCKET = os.environ.get("CALIBRATOR_S3_BUCKET")
CALIBRATOR_S3_KEY = os.environ.get("CALIBRATOR_S3_KEY")

AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL")

POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "10"))

DEFAULT_SEX = os.environ.get("DEFAULT_SEX", "M")
DEFAULT_AGE = int(os.environ.get("DEFAULT_AGE", "60"))

PARTICIPANTS_TABLE = os.environ.get("PARTICIPANTS_TABLE", "participants")
PARTICIPANT_ID_COLUMN = os.environ.get("PARTICIPANT_ID_COLUMN", "id")
PARTICIPANT_SEX_COLUMN = os.environ.get("PARTICIPANT_SEX_COLUMN", "sex")
PARTICIPANT_AGE_COLUMN = os.environ.get("PARTICIPANT_AGE_COLUMN", "age")
PARTICIPANT_BIRTHDATE_COLUMN = os.environ.get("PARTICIPANT_BIRTHDATE_COLUMN", "birth_date")
PARTICIPANT_NAME_COLUMN = os.environ.get("PARTICIPANT_NAME_COLUMN", "full_name")

ENABLED_TEST_TYPES = {
    s.strip().upper()
    for s in os.environ.get("ENABLED_TEST_TYPES", "MARCHA,SL30S,IVCF20").split(",")
    if s.strip()
}

def _make_s3_client():
    session = boto3.session.Session(region_name=AWS_REGION)
    return session.client("s3", endpoint_url=AWS_S3_ENDPOINT_URL) if AWS_S3_ENDPOINT_URL else session.client("s3")


s3_client = _make_s3_client()


def _connect() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


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
    try:
        sql = f"SELECT * FROM {PARTICIPANTS_TABLE} WHERE {PARTICIPANT_ID_COLUMN} = %s LIMIT 1"
        with _connect() as conn:
            row = conn.execute(sql, (participant_id,)).fetchone()
        return dict(row) if row else None
    except Exception as e:
        log(f"Lookup de participante ignorado: {e}")
        return None


def resolve_subject_meta(session_row: Dict[str, Any]) -> Dict[str, Any]:
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
    sujeito = session_name or participant_name or f"{participant_id[:8]}_S{session_row['session_number']}"

    return {
        "sexo": sex,
        "idade": int(age),
        "sujeito": str(sujeito),
    }


# ===========================================================
# STORAGE / DB
# ===========================================================

def download_raw_file(bucket: str, key: str) -> bytes:
    try:
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        return obj["Body"].read()
    except NoCredentialsError as e:
        raise RuntimeError(
            "AWS sem credenciais. Defina AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (e opcional AWS_SESSION_TOKEN) no Render."
        ) from e
    except ClientError as e:
        raise RuntimeError(f"Falha ao baixar do S3 (bucket={bucket}, key={key}): {e}") from e


def ensure_calibrator_ready() -> None:
    """
    Garante que o calibrador exista localmente.
    Em ambientes imutáveis (ex: Render), preferir baixar do S3 para /tmp.
    """
    global CALIBRATOR_PATH

    if os.path.exists(CALIBRATOR_PATH):
        return

    if not CALIBRATOR_S3_BUCKET or not CALIBRATOR_S3_KEY:
        raise FileNotFoundError(
            "Calibrador .joblib não encontrado. "
            "Ou inclua o arquivo no deploy em CALIBRATOR_PATH, "
            "ou defina CALIBRATOR_S3_BUCKET e CALIBRATOR_S3_KEY para baixar do S3."
        )

    os.makedirs("/tmp/app60-worker", exist_ok=True)
    local_path = os.path.join("/tmp/app60-worker", os.path.basename(CALIBRATOR_S3_KEY))

    if os.path.exists(local_path):
        CALIBRATOR_PATH = local_path
        return

    log(f"Baixando calibrador do S3 bucket={CALIBRATOR_S3_BUCKET} key={CALIBRATOR_S3_KEY}")
    try:
        s3_client.download_file(CALIBRATOR_S3_BUCKET, CALIBRATOR_S3_KEY, local_path)
    except NoCredentialsError as e:
        raise RuntimeError(
            "AWS sem credenciais para baixar o calibrador. Defina AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY no Render."
        ) from e
    except ClientError as e:
        raise RuntimeError(f"Falha ao baixar calibrador do S3: {e}") from e

    CALIBRATOR_PATH = local_path


def claim_next_session() -> Optional[Dict[str, Any]]:
    """
    Próxima coleta com processing_status = pending entre os testes habilitados.
    Um worker por instância; usa SKIP LOCKED para múltiplos workers.
    """
    if not ENABLED_TEST_TYPES:
        return None

    types = sorted(ENABLED_TEST_TYPES)
    with _connect() as conn:
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id FROM collections
                    WHERE processing_status = 'pending'
                      AND test_type::text = ANY(%s)
                    ORDER BY created_at ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """,
                    (types,),
                )
                hit = cur.fetchone()
                if not hit:
                    conn.rollback()
                    return None
                cid = hit["id"]
                cur.execute(
                    """
                    UPDATE collections
                    SET processing_status = 'processing',
                        processing_error = NULL,
                        updated_at = now()
                    WHERE id = %s
                    RETURNING *
                    """,
                    (cid,),
                )
                row = cur.fetchone()
            conn.commit()
            return dict(row) if row else None
        except Exception:
            conn.rollback()
            raise


def mark_done(session_id: str) -> None:
    with _connect() as conn:
        conn.execute(
            """
            UPDATE collections
            SET processing_status = 'done',
                processing_error = NULL,
                updated_at = now()
            WHERE id = %s
            """,
            (session_id,),
        )
        conn.commit()


def mark_error(session_id: str, err: Exception) -> None:
    with _connect() as conn:
        conn.execute(
            """
            UPDATE collections
            SET processing_status = 'error',
                processing_error = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (safe_error_text(err), session_id),
        )
        conn.commit()


def upsert_result(
    session_row: Dict[str, Any],
    metrics: Dict[str, Any],
    extra_payload: Optional[Dict[str, Any]] = None,
) -> None:
    collection_id = session_row["id"]
    participant_id = session_row["participant_id"]
    test_type = session_row["test_type"]
    session_number = session_row["session_number"]
    plot_data = None
    if extra_payload and "plot_json" in extra_payload:
        plot_data = extra_payload.get("plot_json")

    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO collection_results (
              collection_id, participant_id, test_type, session_number, metrics_json, plot_json
            ) VALUES (%s, %s, %s::test_kind, %s, %s, %s)
            ON CONFLICT (collection_id) DO UPDATE SET
              metrics_json = EXCLUDED.metrics_json,
              plot_json = EXCLUDED.plot_json,
              updated_at = now()
            """,
            (
                collection_id,
                participant_id,
                test_type,
                session_number,
                Json(metrics),
                Json(plot_data) if plot_data is not None else None,
            ),
        )
        conn.commit()


# ===========================================================
# TEST DISPATCHERS
# ===========================================================

def process_marcha(session_row: Dict[str, Any], csv_path: str) -> Dict[str, Any]:
    meta = resolve_subject_meta(session_row)
    log(f"[MARCHA] Meta resolvida | sexo={meta['sexo']} idade={meta['idade']} sujeito={meta['sujeito']}")

    result = process_marcha_csv(
        csv_path=csv_path,
        calibrator_path=CALIBRATOR_PATH,
        sexo=meta["sexo"],
        idade=meta["idade"],
        sujeito=meta["sujeito"],
        include_plot_payload=True,
    )

    return {
        "metrics": result["metrics"],
        "extra_payload": {
            "plot_json": result.get("plot"),
        },
    }


def process_tug(session_row: Dict[str, Any], csv_path: str) -> Dict[str, Any]:
    raise NotImplementedError("TUG ainda não plugado no worker.")


def process_sl30s(session_row: Dict[str, Any], csv_path: str) -> Dict[str, Any]:
    meta = resolve_subject_meta(session_row)
    log(f"[SL30S] Meta resolvida | sexo={meta['sexo']} idade={meta['idade']} sujeito={meta['sujeito']}")

    result = process_sl30s_csv(
        csv_path=csv_path,
        sexo=meta["sexo"],
        idade=meta["idade"],
        sujeito=meta["sujeito"],
        include_plot_payload=True,
    )

    return {
        "metrics": result["metrics"],
        "extra_payload": {
            "plot_json": result.get("plot"),
        },
    }


def process_los(session_row: Dict[str, Any], csv_path: str) -> Dict[str, Any]:
    raise NotImplementedError("LOS ainda não plugado no worker.")


def process_utt(session_row: Dict[str, Any], csv_path: str) -> Dict[str, Any]:
    raise NotImplementedError("UTT ainda não plugado no worker.")


def process_ivcf20(session_row: Dict[str, Any], raw_path: str) -> Dict[str, Any]:
    result = process_ivcf20_file(raw_path)

    metrics = result["metrics"]
    log(
        "[IVCF20] Resumo pronto "
        f"| score={metrics.get('score_total')} "
        f"class={metrics.get('classification_label')}"
    )

    return {
        "metrics": metrics,
        "extra_payload": {
            "plot_json": None,
        },
    }


def process_fesi(session_row: Dict[str, Any], raw_path: str) -> Dict[str, Any]:
    result = process_fesi_file(raw_path)
    metrics = result["metrics"]
    log(
        "[FESI] Resumo pronto "
        f"| score={metrics.get('score_total')} "
        f"class={metrics.get('classification_label')}"
    )
    return {
        "metrics": metrics,
        "extra_payload": {
            "plot_json": None,
        },
    }


def process_act_sedentary(session_row: Dict[str, Any], raw_path: str) -> Dict[str, Any]:
    result = process_act_sedentary_file(raw_path)
    metrics = result["metrics"]
    log("[ACT_SEDENTARY] Resumo pronto")
    return {
        "metrics": metrics,
        "extra_payload": {
            "plot_json": None,
        },
    }


TEST_PROCESSORS = {
    "MARCHA": process_marcha,
    "TUG": process_tug,
    "SL30S": process_sl30s,
    "LOS": process_los,
    "UTT": process_utt,
    "IVCF20": process_ivcf20,
    "FESI": process_fesi,
    "ACT_SEDENTARY": process_act_sedentary,
}


# ===========================================================
# PROCESSAMENTO
# ===========================================================

def process_one(session_row: Dict[str, Any]) -> None:
    test_type = str(session_row["test_type"]).upper()
    bucket = session_row["raw_s3_bucket"]
    raw_storage_path = session_row["raw_s3_key"]

    if test_type not in TEST_PROCESSORS:
        raise ValueError(f"test_type não suportado no worker: {test_type}")

    processor = TEST_PROCESSORS[test_type]

    log(f"Baixando raw do bucket={bucket} key={raw_storage_path}")
    raw_bytes = download_raw_file(bucket, raw_storage_path)

    raw_ext = os.path.splitext(raw_storage_path)[1].strip() or ".bin"

    with tempfile.TemporaryDirectory() as tmpdir:
        local_raw_path = os.path.join(tmpdir, f"raw{raw_ext}")

        with open(local_raw_path, "wb") as f:
            f.write(raw_bytes)

        result = processor(session_row, local_raw_path)

        metrics = result["metrics"]
        extra_payload = result.get("extra_payload")

        log(f"[{test_type}] Métricas prontas: {metrics}")
        upsert_result(session_row, metrics, extra_payload=extra_payload)
        mark_done(session_row["id"])


# ===========================================================
# MAIN LOOP
# ===========================================================

def main() -> None:
    ensure_calibrator_ready()
    log(f"Worker iniciado (RDS+S3). Testes habilitados: {sorted(ENABLED_TEST_TYPES)}")

    while True:
        row: Optional[Dict[str, Any]] = None
        try:
            row = claim_next_session()

            if row is None:
                time.sleep(POLL_SECONDS)
                continue

            log(
                f"Processando coleta id={row['id']} "
                f"test_type={row['test_type']} "
                f"participant_id={row['participant_id']} "
                f"session={row['session_number']}"
            )

            process_one(row)

            log(f"OK coleta {row['id']} finalizada.")
            time.sleep(1)

        except Exception as e:
            log("ERRO no worker:")
            traceback.print_exc()

            if row and row.get("id"):
                try:
                    mark_error(row["id"], e)
                except Exception:
                    log("Falha ao marcar coleta como error.")
                    traceback.print_exc()

            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
