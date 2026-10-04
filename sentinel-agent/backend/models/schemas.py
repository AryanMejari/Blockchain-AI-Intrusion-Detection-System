from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator, model_validator

ALLOWED_TYPES = {
    "failed_login",
    "successful_login",
    "sensitive_access",
    "privilege_change",
    "unusual_process",
    "invalid_request",
    "rate_limit_event",
    "account_lockout",
}

ALERT_STATUSES = {"new", "investigating", "resolved", "false_positive"}


class SecurityEvent(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    type: str
    timestamp: str = Field(min_length=1, max_length=80)
    user: str = Field(min_length=1, max_length=100)
    source: str = Field(default="127.0.0.1", max_length=100)
    severity: str = Field(default="low", max_length=20)
    detection_status: str = Field(default="pending", max_length=50)
    investigation_id: str | None = None
    detail: str = Field(default="", max_length=500)
    count: int | None = Field(default=None, ge=0, le=100000)
    context: str | None = None
    resource: str | None = None
    process: str | None = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in ALLOWED_TYPES:
            raise ValueError(f"Unsupported event type: {value}")
        return value

    @field_validator("context")
    @classmethod
    def valid_context(cls, value: str | None) -> str | None:
        if value is not None and value not in {"usual", "unusual_time", "suspicious_source", "unknown"}:
            raise ValueError("context must be usual, unusual_time, suspicious_source, or unknown")
        return value

    @model_validator(mode="after")
    def require_type_specific_fields(self):
        # Type requirements matching previous test_api assertions
        required = {
            "failed_login": ("count",),
            "successful_login": ("context",),
            "sensitive_access": ("resource",),
            "unusual_process": ("process",),
            "privilege_change": (),
            "invalid_request": (),
            "rate_limit_event": (),
            "account_lockout": (),
        }[self.type]
        missing = [name for name in required if getattr(self, name) is None]
        if missing:
            raise ValueError(f"{self.type} requires: {', '.join(missing)}")
        return self


class AnalyzeRequest(BaseModel):
    events: list[SecurityEvent] = Field(min_length=1, max_length=500)

    @field_validator("events")
    @classmethod
    def unique_event_ids(cls, events: list[SecurityEvent]) -> list[SecurityEvent]:
        ids = [event.id for event in events]
        if len(ids) != len(set(ids)):
            raise ValueError("Event IDs must be unique")
        return events


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)
    simulated_source: str = Field(default="192.168.1.100", max_length=100)
    simulated_context: str = Field(default="usual", max_length=50)


class AlertStatusUpdate(BaseModel):
    status: Literal["new", "investigating", "resolved", "false_positive"]


class MetricsResponse(BaseModel):
    total_events: int
    failed_logins: int
    active_alerts: int
    critical_alerts: int
    high_alerts: int
    medium_alerts: int
    low_alerts: int
    suspicious_accounts: int
    investigations_in_progress: int


class ScenarioRunRequest(BaseModel):
    scenario_id: str | None = None
    target_user: str | None = None
    source_ip: str | None = None
