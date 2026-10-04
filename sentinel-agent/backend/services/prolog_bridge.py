from __future__ import annotations

import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any
from fastapi import HTTPException

logger = logging.getLogger("sentinel.prolog")

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine" / "sentinel.pl"
SWIPL = os.getenv("SWIPL_BIN", "swipl")


def check_prolog_available() -> bool:
    try:
        res = subprocess.run([SWIPL, "--version"], capture_output=True, text=True, timeout=2)
        return res.returncode == 0
    except Exception:
        return False


def run_prolog(payload: dict[str, Any]) -> dict[str, Any]:
    """Run a fresh, bounded Prolog process per request; no persistent user state."""
    try:
        result = subprocess.run(
            [SWIPL, "-q", "-s", str(ENGINE)],
            input=json.dumps(payload, ensure_ascii=False) + "\n",
            text=True,
            capture_output=True,
            timeout=5,
            check=False,
            cwd=str(ROOT),
        )
    except FileNotFoundError as exc:
        logger.error("SWI-Prolog binary not found at %s", SWIPL)
        raise HTTPException(
            status_code=503,
            detail="SWI-Prolog not found. Install SWI-Prolog and ensure swipl is on PATH.",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        logger.error("Prolog execution timed out after 5 seconds")
        raise HTTPException(status_code=504, detail="Reasoning engine timed out") from exc
    except Exception as exc:
        logger.error("Unexpected error invoking Prolog engine: %s", exc)
        raise HTTPException(status_code=502, detail="Reasoning engine invocation failed") from exc

    if result.returncode != 0:
        logger.error("Prolog returned non-zero code %d. stderr: %s", result.returncode, result.stderr)
        raise HTTPException(status_code=502, detail="Reasoning engine failed to process this investigation")

    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        logger.error("Failed to decode JSON from Prolog output: %s", result.stdout)
        raise HTTPException(status_code=502, detail="Reasoning engine returned invalid output") from exc

    return output
