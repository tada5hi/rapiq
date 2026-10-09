# Copyright (c) 2026.
# Author Peter Placzek (tada5hi)
# For the full copyright and license information,
# view the LICENSE file that was distributed with this source code.

"""Python binding for the rapiq Rust core (proof of concept).

Filter trees use the serialized IR shared with the TypeScript
packages::

    {"type": "filters", "operator": "and", "value": [...]}
    {"type": "filter", "operator": "eq", "field": "name", "value": "admin"}

Records must be JSON-serializable (``json.dumps``).
"""

from __future__ import annotations

import json
from typing import Any, Dict, Iterable, List, Optional, Sequence, TypeVar

from . import _native

__all__ = [
    "RapiqError",
    "Predicate",
    "compile_filters",
    "matches",
    "parse_expression_filters",
    "parse_expression_filters_exact",
]

T = TypeVar("T")
Condition = Dict[str, Any]


class RapiqError(Exception):
    """A rapiq failure; ``code`` is the rapiq ErrorCode value."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _call(fn, *args):
    try:
        return fn(*args)
    except _native.RapiqError as error:
        raise RapiqError(*error.args) from None


def _options(options: Optional[Dict[str, Any]]) -> Optional[str]:
    return json.dumps(options) if options else None


def parse_expression_filters(input: Optional[str] = None) -> Condition:
    """Parse an expression into the root filter group (schemaless)."""
    return json.loads(_call(_native.parse_expression_filters, input))


def parse_expression_filters_exact(input: str) -> Condition:
    """Parse an expression into its exact condition tree (schemaless)."""
    return json.loads(_call(_native.parse_expression_filters_exact, input))


def matches(
    filters: Condition,
    record: Any,
    options: Optional[Dict[str, Any]] = None,
) -> bool:
    """Does the record satisfy the filters?"""
    return _call(
        _native.matches,
        json.dumps(filters),
        json.dumps(record),
        _options(options),
    )


class Predicate:
    """A filter tree compiled once, evaluated many times."""

    def __init__(
        self,
        filters: Condition,
        options: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._native = _call(_native.Predicate, json.dumps(filters), _options(options))

    def test(self, record: Any) -> bool:
        return _call(self._native.test, json.dumps(record))

    def __call__(self, record: Any) -> bool:
        return self.test(record)

    def filter(self, records: Iterable[T]) -> List[T]:
        """Keep the records satisfying the predicate (same objects, same order)."""
        items: Sequence[T] = records if isinstance(records, Sequence) else list(records)
        indices = _call(self._native.filter_indices, json.dumps(items))

        return [items[index] for index in indices]


def compile_filters(
    filters: Condition,
    options: Optional[Dict[str, Any]] = None,
) -> Predicate:
    return Predicate(filters, options)
