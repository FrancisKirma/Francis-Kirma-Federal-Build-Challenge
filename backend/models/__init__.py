"""Shared shapes.

``domain`` holds what the tool reasons about; ``api`` holds request and response
bodies. Re-exported here so callers import from one place.
"""

from models.domain import (
    FIELD_ORDER,
    ClaimedFields,
    ExtractedFields,
    FieldResult,
    Status,
    VerificationResult,
)

__all__ = [
    "FIELD_ORDER",
    "ClaimedFields",
    "ExtractedFields",
    "FieldResult",
    "Status",
    "VerificationResult",
]
