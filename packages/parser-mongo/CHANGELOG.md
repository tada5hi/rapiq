# Changelog

## [2.0.0-beta.7](https://github.com/tada5hi/rapiq/compare/parser-mongo-v2.0.0-beta.6...parser-mongo-v2.0.0-beta.7) (2026-07-22)


### Features

* **core:** authorize relation paths traversed by filters/fields/sort ([#815](https://github.com/tada5hi/rapiq/issues/815)) ([#816](https://github.com/tada5hi/rapiq/issues/816)) ([1f98ff3](https://github.com/tada5hi/rapiq/commit/1f98ff3f577eb702d1b55ee6e7b3a3a166d5c44a))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
    * @rapiq/parser-simple bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
    * @rapiq/parser-simple bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7

## [2.0.0-beta.6](https://github.com/tada5hi/rapiq/compare/parser-mongo-v2.0.0-beta.5...parser-mongo-v2.0.0-beta.6) (2026-07-21)


### Miscellaneous Chores

* **parser-mongo:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
    * @rapiq/parser-simple bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
    * @rapiq/parser-simple bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6

## [2.0.0-beta.5](https://github.com/tada5hi/rapiq/compare/parser-mongo-v2.0.0-beta.4...parser-mongo-v2.0.0-beta.5) (2026-07-21)


### Features

* **core:** request-context threading & per-parameter schema validate hooks ([#807](https://github.com/tada5hi/rapiq/issues/807)) ([605993c](https://github.com/tada5hi/rapiq/commit/605993c8a5ef120e1a0c931eba88971ca3ee052f))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
    * @rapiq/parser-simple bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
    * @rapiq/parser-simple bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5

## [2.0.0-beta.4](https://github.com/tada5hi/rapiq/compare/parser-mongo-v2.0.0-beta.3...parser-mongo-v2.0.0-beta.4) (2026-07-20)


### Miscellaneous Chores

* **parser-mongo:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
    * @rapiq/parser-simple bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
    * @rapiq/parser-simple bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4

## [2.0.0-beta.3](https://github.com/tada5hi/rapiq/compare/parser-mongo-v2.0.0-beta.2...parser-mongo-v2.0.0-beta.3) (2026-07-20)


### Miscellaneous Chores

* **parser-mongo:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
    * @rapiq/parser-simple bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
    * @rapiq/parser-simple bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3

## [2.0.0-beta.2](https://github.com/tada5hi/rapiq/compare/parser-mongo-v2.0.0-beta.1...parser-mongo-v2.0.0-beta.2) (2026-07-20)


### Miscellaneous Chores

* **parser-mongo:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
    * @rapiq/parser-simple bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
    * @rapiq/parser-simple bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2

## [2.0.0-beta.1](https://github.com/tada5hi/rapiq/compare/parser-mongo-v2.0.0-beta.0...parser-mongo-v2.0.0-beta.1) (2026-07-19)


### Miscellaneous Chores

* **parser-mongo:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-simple bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-simple bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1

## [2.0.0-beta.0](https://github.com/tada5hi/rapiq/compare/parser-mongo-v1.0.0...parser-mongo-v2.0.0-beta.0) (2026-07-17)


### ⚠ BREAKING CHANGES

* every elemMatch node now opens its own quantifier scope in @rapiq/memory - two elemMatches on one field (or an elemMatch beside a dotted sibling) bind independent elements (mongo semantics) instead of sharing one binding. $-prefixed keys are no longer accepted as field names in the build-layer filters object grammar. In the expression filter dialect, elemMatch is now a reserved keyword and $-prefixed words are reserved markers, so fields with these names no longer tokenize.
* the filters Validator type returns MaybeAsync<IFilter | undefined> (no void); relation aliases longer than 63 characters gain a hash suffix; TypeORM filter parameters are named rapiq_<n>_<i> instead of positional 0, 1, ...
* relation aliases now use length-prefixed path segments to avoid collisions.

### Features

* add ITSELF self-reference marker for element-level $elemMatch and $all ([#770](https://github.com/tada5hi/rapiq/issues/770)) ([e1d5c4c](https://github.com/tada5hi/rapiq/commit/e1d5c4c0f4c94bcde359aa92cc118cd773641c03))
* add size array-length filter operator ([#771](https://github.com/tada5hi/rapiq/issues/771)) ([013bf06](https://github.com/tada5hi/rapiq/commit/013bf06be06d1aef808f50e9a5dc922ab36f75ab))
* **parser-mongo:** mongodb query parser dialect ([#751](https://github.com/tada5hi/rapiq/issues/751)) ([d96711b](https://github.com/tada5hi/rapiq/commit/d96711b4d1d482761433cc879220c3a51ce88474))


### Bug Fixes

* harden filter validation and adapter state preservation ([#766](https://github.com/tada5hi/rapiq/issues/766)) ([97e11d4](https://github.com/tada5hi/rapiq/commit/97e11d450e8596d6a90869d30453f363add82bb9))
* harden v2 beta release ([#763](https://github.com/tada5hi/rapiq/issues/763)) ([51a906a](https://github.com/tada5hi/rapiq/commit/51a906aa1e5d9e8e4bd1e4dc0f9fce8ec4aaddeb))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-simple bumped from ^1.0.0 to ^2.0.0-beta.0
  * peerDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-simple bumped from ^1.0.0 to ^2.0.0-beta.0
