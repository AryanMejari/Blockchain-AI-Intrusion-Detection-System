from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent / "sentinel.db"


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    # Using standard PBKDF2 HMAC-SHA256 with 100,000 iterations
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return key.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    derived_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(derived_hash, password_hash)


def init_db() -> None:
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS demo_users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        user TEXT NOT NULL,
        source TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'low',
        detection_status TEXT NOT NULL DEFAULT 'pending',
        investigation_id TEXT,
        detail TEXT,
        count INTEGER DEFAULT 1,
        context TEXT,
        resource TEXT,
        process TEXT,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        severity TEXT NOT NULL,
        risk_score INTEGER DEFAULT 50,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        confidence TEXT NOT NULL,
        summary TEXT NOT NULL,
        evidence_ids TEXT NOT NULL,
        evidence_count INTEGER DEFAULT 0,
        rationale TEXT NOT NULL,
        rule TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        observed_facts TEXT NOT NULL,
        inferred_facts TEXT NOT NULL,
        missing_evidence TEXT NOT NULL,
        alternative_explanations TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS investigations (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        hypothesis_type TEXT NOT NULL,
        timeline_json TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)


    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_reports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ipfs_cid TEXT NOT NULL,
        block_height INTEGER NOT NULL,
        status TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        report_json TEXT NOT NULL
    );
    """)

    conn.commit()

    # Seed demo users if empty
    cursor.execute("SELECT COUNT(*) as count FROM demo_users")
    row = cursor.fetchone()
    if row and row["count"] == 0:
        demo_accounts = [
            ("alice", "Sentinel@2026!", "Alice Walker", "Security Analyst"),
            ("bob", "Password123!", "Bob Vance", "Engineering"),
            ("j.singh", "Finance#2026", "J. Singh", "Financial Operations"),
            ("svc-build", "BuildMachine99$", "CI/CD Service Account", "Automation"),
            ("admin", "AdminMaster2026!", "System Administrator", "Platform Ops"),
        ]
        for username, password, display_name, role in demo_accounts:
            pw_hash, salt = hash_password(password)
            cursor.execute(
                "INSERT INTO demo_users (username, password_hash, salt, display_name, role) VALUES (?, ?, ?, ?, ?)",
                (username, pw_hash, salt, display_name, role),
            )
        conn.commit()

    conn.close()


init_db()
