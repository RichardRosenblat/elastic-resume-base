"""Synapse domain-specific error classes."""

from __future__ import annotations


class SynapseError(Exception):
    """Base class for all Synapse persistence errors."""


class SynapseNotFoundError(SynapseError):
    """Raised when a requested document does not exist in Firestore."""


class SynapseConflictError(SynapseError):
    """Raised when a document already exists and creation would conflict."""
