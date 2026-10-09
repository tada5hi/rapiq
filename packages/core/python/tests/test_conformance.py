# Copyright (c) 2026.
# Author Peter Placzek (tada5hi)
# For the full copyright and license information,
# view the LICENSE file that was distributed with this source code.

"""Runs the conformance fixtures (packages/<package>/fixtures) against the
Python binding. The fixtures are generated from, and re-checked against,
the TypeScript reference implementation."""

import json
from pathlib import Path

import pytest

import rapiq
from rapiq import core

PACKAGES = Path(__file__).resolve().parents[3]


def load(name):
    return json.loads((PACKAGES / name).read_text(encoding="utf-8"))


EXPRESSION_CASES = load("parser-expression/fixtures/expression.json")
EVALUATE_GROUPS = load("adapter-memory/fixtures/evaluate.json")


def test_fixture_sets_are_present():
    assert len(EXPRESSION_CASES) > 90
    assert len(EVALUATE_GROUPS) > 150


@pytest.mark.parametrize("case", EXPRESSION_CASES, ids=lambda c: repr(c["input"])[:60])
def test_expression_parser(case):
    if "error" in case:
        with pytest.raises(core.RapiqError) as raised:
            core.parse_expression_filters_exact(case["input"])

        assert raised.value.code == case["error"]
        return

    assert core.parse_expression_filters_exact(case["input"]) == case["exact"]
    assert core.parse_expression_filters(case["input"]) == case["parse"]


@pytest.mark.parametrize("group", EVALUATE_GROUPS, ids=lambda g: g["name"])
def test_evaluator(group):
    options = group.get("options")

    if "error" in group:
        with pytest.raises(core.RapiqError) as raised:
            core.compile_filters(group["filters"], options)

        assert raised.value.code == group["error"]
        return

    predicate = core.compile_filters(group["filters"], options)
    for item in group["cases"]:
        assert predicate.test(item["record"]) is item["expected"], item["record"]


def test_filter_keeps_the_record_objects():
    predicate = core.compile_filters(core.parse_expression_filters("gte(age, '18')"))
    records = [{"age": 17}, {"age": 18}, {"age": 30}]

    kept = predicate.filter(records)

    assert kept == [{"age": 18}, {"age": 30}]
    assert kept[0] is records[1]


def test_absent_input_is_an_empty_group():
    assert core.parse_expression_filters() == {"type": "filters", "operator": "and", "value": []}


def test_one_shot_matches():
    filters = {"type": "filter", "operator": "eq", "field": "name", "value": "Peter"}

    assert core.matches(filters, {"name": "peter"})
    assert not core.matches(filters, {"name": "peter"}, {"caseSensitive": True})


def test_rapiq_is_a_namespace_package():
    # the parts (rapiq-core, rapiq-parser-mongo, ...) are separate wheels
    # sharing the `rapiq.` prefix, so no distribution may own rapiq/__init__.py
    assert getattr(rapiq, "__file__", None) is None
    assert core.__name__ == "rapiq.core"

