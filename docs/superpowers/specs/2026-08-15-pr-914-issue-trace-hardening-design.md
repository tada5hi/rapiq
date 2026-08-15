# PR 914 Issue-Trace Hardening Design

## Context

PR #914 introduces aggregated parse-error issue traces. The audit confirmed
five correctness gaps in the new trace path:

- a structural parser abort disappears when the same standalone parse already
  recorded a policy rejection;
- one parameter's issue suppresses the independent filter and sort index
  policies;
- recursive and structural rejection sites can report incomplete paths or omit
  the offending value;
- `parseExact` and empty allow-list shortcuts bypass parts of the trace and
  grammar validation lifecycle;
- the issue cap counts tree roots instead of violations, while serialized
  issues can expose raw expected and received values.

The fixes stay within the architecture introduced by the PR: parsers record
plain blemish issues into a shared collector, an owning parse raises once, and
drop-mode parses remain silent. The compatibility decisions and public
collector-ownership behavior called out separately by the audit are outside
this change.

## Goals

- Preserve every independently actionable failure until the documented limit.
- Report absolute paths and the rejected value at the closest site that knows
  them.
- Apply independent post-parse policies independently.
- Validate malformed input even when schema policy will ultimately reject all
  keys.
- Keep raw diagnostic values available on a live error without sending them
  through `BaseError.toJSON()`.
- Exercise synchronous, asynchronous, throwing, dropping, capped, and malformed
  paths with regression tests.

## Non-goals

- Do not revise the PR's chosen error-class or error-code compatibility
  contract.
- Do not expose caller-supplied issue collectors or change trace ownership.
- Do not redesign relation pruning, schema validation hooks, or parser grammar.
- Do not add a configurable redaction API. Default JSON serialization simply
  omits raw `expected` and `received` values.
- Do not turn drop mode into an observable diagnostics channel.

## Collector and Failure Semantics

`MAX_ISSUES` applies to leaf `IssueItem` violations, not top-level tree nodes.
The collector preserves incoming group structure while retaining only the
pre-order prefix that fits within the remaining leaf budget. Empty group
shells are discarded. `ParseError.inputRejected()` also counts flattened leaf
items, so its message agrees with the number of reported violations.

An owned parser always hands a caught branded parse error to `addError`, even
when its collector already contains issues. This retains a later malformed
expression or Mongo operator document behind an earlier allow-list or validator
failure. If the normal leaf budget is already full, the structural abort has
priority over the final ordinary leaf: the collector removes its last leaf,
prunes any now-empty group ancestors, and records the first leaf represented by
the abort. The trace therefore remains bounded by `MAX_ISSUES`, preserves its
first-failure ordering, and never hides the fact that parsing structurally
aborted.

An error that already carries an issue tree contributes that tree. An error
without issues becomes one item using its code, message, parameter, and known
path. Non-parse exceptions continue to propagate unchanged.

## Independent Index Policies

Filter and sort index checks no longer use the collector's global `failed`
flag. Each policy inspects flattened issues for its own canonical parameter:

- a prior filters issue suppresses only the filters index check;
- a prior sorts issue suppresses only the sorts index check;
- fields, relations, pagination, or the other indexed parameter do not suppress
  it.

This keeps consequence errors out when the same parameter was already pruned or
rejected, while allowing a query with independently invalid filter and sort
combinations to report both. The check remains an internal helper over the
existing `IIssueCollector.issues` contract; no new method is added to the public
collector interface.

## Absolute Issue Locations

Recursive parsing and validation carry an explicit path prefix. A leaf rejected
inside `elemMatch(items, ...)` reports `['items', <leaf>]`; nested element
matches accumulate every addressable outer segment. Synchronous and
asynchronous filter validators use the same path construction.

The simple fields, relations, and sorts normalizers retain the path of the
object branch being traversed. Invalid nested values report that path and the
exact invalid value instead of a parameter-level issue. Mongo structural
operator validation similarly attaches the current canonical field path and
the operator value or document that failed. Grammar failures without a field
remain parameter-level issues.

Paths remain absolute blemish paths and continue to use canonical,
alias-resolved segments wherever resolution has succeeded. A rejection that
happens before resolution uses the client spelling and retains that spelling in
the existing issue metadata when applicable.

## Parser Lifecycle

`ExpressionFiltersParser.parseExact()` and `parseExactAsync()` use the same
owned trace wrapper as other standalone entry points. Syntax errors are
therefore converted into non-empty filter issue traces, while non-parse
exceptions still escape.

Empty allow-lists no longer return before input normalization and grammar
validation. Supplied input is parsed far enough to establish whether it is
well-formed, then ordinary resolution policy rejects or drops its keys. This
gives the following precedence:

- malformed shape or syntax remains an input/syntax failure;
- well-formed disallowed keys follow throw/drop policy;
- absent input still produces the existing empty/default result;
- drop mode still applies configured defaults after no client input survives.

This rule applies consistently to simple fields, filters, relations, and sorts,
and to Mongo filters.

## Serialization Boundary

The live `BaseError.issues` tree remains unchanged and may contain `expected`
and `received` values for trusted in-process diagnostics. `BaseError.toJSON()`
shallow-copies each issue node, recursively rebuilds group children, and omits
both value members from every leaf. Metadata and structured data follow their
normal JSON semantics; rapiq does not implement a second general-purpose object
serializer for them. Serialization does not mutate the live issues.

Documentation will state both sides of the contract: `expected` and `received`
are available in process and intentionally redacted from the default wire form.

## Testing

Core regression tests cover:

- an earlier recorded rejection followed by a structural abort;
- that abort at the exact leaf cap;
- a nested issue group larger than `MAX_ISSUES`, preserved tree shape, empty
  group pruning, and a flattened violation count in the raised message;
- parameter-local index-policy suppression and simultaneous invalid filters
  and sorts;
- non-mutating serialization of nested groups with circular `expected` and
  `received` values omitted.

Dialect integration tests cover:

- standalone and whole-query Mongo structural failures after another rejected
  key;
- expression `parseExact` and `parseExactAsync` syntax failures with populated
  traces;
- synchronous and asynchronous `elemMatch` validator rejection paths;
- nested invalid simple field, relation, and sort values with `received`;
- malformed and well-formed input under empty allow-lists, in both throw and
  drop modes, including default fallback;
- independent filter and sort index failures in one query.

The verification gate runs targeted affected-package tests first, direct
TypeScript builds for every affected package, then the relevant package test
suites, lint, and documentation build. A full monorepo test/build run follows
when the targeted gates are green.
