# Changelog

## [2.0.0-beta.1](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.0...memory-v2.0.0-beta.1) (2026-07-19)


### Miscellaneous Chores

* **memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1

## [2.0.0-beta.0](https://github.com/tada5hi/rapiq/compare/memory-v1.0.0...memory-v2.0.0-beta.0) (2026-07-17)


### ⚠ BREAKING CHANGES

* every elemMatch node now opens its own quantifier scope in @rapiq/memory - two elemMatches on one field (or an elemMatch beside a dotted sibling) bind independent elements (mongo semantics) instead of sharing one binding. $-prefixed keys are no longer accepted as field names in the build-layer filters object grammar. In the expression filter dialect, elemMatch is now a reserved keyword and $-prefixed words are reserved markers, so fields with these names no longer tokenize.
* relation aliases now use length-prefixed path segments to avoid collisions.
* eq/ne/in/nin match strings case-insensitively on every adapter; previously case behavior followed the database collation (case-sensitive on postgres/sqlite/oracle and in @rapiq/memory).

### Features

* add ITSELF self-reference marker for element-level $elemMatch and $all ([#770](https://github.com/tada5hi/rapiq/issues/770)) ([e1d5c4c](https://github.com/tada5hi/rapiq/commit/e1d5c4c0f4c94bcde359aa92cc118cd773641c03))
* add size array-length filter operator ([#771](https://github.com/tada5hi/rapiq/issues/771)) ([013bf06](https://github.com/tada5hi/rapiq/commit/013bf06be06d1aef808f50e9a5dc922ab36f75ab))
* case-insensitive string equality with per-field opt-out ([#762](https://github.com/tada5hi/rapiq/issues/762)) ([5821c59](https://github.com/tada5hi/rapiq/commit/5821c593497a5c779d72dd0b4494cc36991284b1))
* **memory:** in-memory query evaluation adapter ([#753](https://github.com/tada5hi/rapiq/issues/753)) ([e03c251](https://github.com/tada5hi/rapiq/commit/e03c2518df9a5238ed4f41afd37b99b41b8302a1))


### Bug Fixes

* harden v2 beta release ([#763](https://github.com/tada5hi/rapiq/issues/763)) ([51a906a](https://github.com/tada5hi/rapiq/commit/51a906aa1e5d9e8e4bd1e4dc0f9fce8ec4aaddeb))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
  * peerDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
