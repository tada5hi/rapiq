# Copyright (c) 2026.
# Author Peter Placzek (tada5hi)
# For the full copyright and license information,
# view the LICENSE file that was distributed with this source code.

"""Throughput of the Python binding (no Python reference exists to
compare against). Run after `maturin develop --release`:

    python crates/rapiq-py/scripts/bench.py
"""

import json
import statistics
import time

import rapiq
from rapiq import _native

EXPRESSION = (
    "and(or(eq(name, 'Peter'), startsWith(email, 'admin@')), gte(age, '18'), "
    "elemMatch(items, and(eq(active, 'true'), in(kind, 'book', 'game'))), not(contains(tags, 'spam')))"
)


def measure(label, iterations, fn):
    for _ in range(min(iterations, 50)):
        fn()

    runs = []
    for _ in range(7):
        start = time.perf_counter()
        for _ in range(iterations):
            fn()
        runs.append((time.perf_counter() - start) / iterations)

    print(f"  {label:<44} {statistics.median(runs) * 1e6:>12.2f} µs/op")


def main():
    print(f"\nparse ({len(EXPRESSION)} chars)")
    measure("rust parse() (IR JSON string)", 20_000, lambda: _native.parse_expression_filters(EXPRESSION))
    measure("rust parse() + json.loads", 20_000, lambda: rapiq.parse_expression_filters(EXPRESSION))

    names = ["Peter", "peter", "Hans", "Anna", "admin"]
    kinds = ["book", "game", "tool"]
    records = [
        {
            "id": i,
            "name": names[i % len(names)],
            "email": f"admin@{i}.test" if i % 7 == 0 else f"user{i}@example.test",
            "age": i % 60,
            "tags": ["spam", "x"] if i % 11 == 0 else ["x", "y"],
            "items": [
                {"kind": kinds[(i + j) % len(kinds)], "active": (i + j) % 3 == 0}
                for j in range(i % 4 + 1)
            ],
        }
        for i in range(100_000)
    ]
    text = json.dumps(records)

    predicate = rapiq.compile_filters(rapiq.parse_expression_filters(EXPRESSION))
    native = predicate._native

    print(f"\nfilter {len(records)} records ({len(predicate.filter(records))} match)")
    measure("rust (records pre-serialized)", 5, lambda: native.filter_indices(text))
    measure("rust (json.dumps per call)", 5, lambda: predicate.filter(records))
    measure("json.dumps(records) alone", 5, lambda: json.dumps(records))

    print("\nper-record call across the boundary")
    sample = records[1]
    sample_text = json.dumps(sample)
    measure("rust test(record_json)", 200_000, lambda: native.test(sample_text))
    measure("rust test(record) incl. json.dumps", 200_000, lambda: predicate.test(sample))


if __name__ == "__main__":
    main()
