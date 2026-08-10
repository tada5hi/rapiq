# Changelog

## [2.0.0-beta.20](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.19...adapter-memory-v2.0.0-beta.20) (2026-08-10)


### Miscellaneous Chores

* **adapter-memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20

## [2.0.0-beta.19](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.18...adapter-memory-v2.0.0-beta.19) (2026-08-07)


### Miscellaneous Chores

* **adapter-memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19

## [2.0.0-beta.18](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.17...adapter-memory-v2.0.0-beta.18) (2026-08-06)


### ⚠ BREAKING CHANGES

* **core:** ICondition implementations must provide immutable seal() behavior; the optional Condition base is now abstract.

### Bug Fixes

* **core:** make condition composition extensible ([#887](https://github.com/tada5hi/rapiq/issues/887)) ([f4627b8](https://github.com/tada5hi/rapiq/commit/f4627b89532c24ec65617596da6b29ab6ebe7fa3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18

## [2.0.0-beta.17](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.16...adapter-memory-v2.0.0-beta.17) (2026-08-05)


### Miscellaneous Chores

* **adapter-memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17

## [2.0.0-beta.16](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.15...adapter-memory-v2.0.0-beta.16) (2026-08-04)


### Miscellaneous Chores

* **adapter-memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16

## [2.0.0-beta.15](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.14...adapter-memory-v2.0.0-beta.15) (2026-08-03)


### Miscellaneous Chores

* **adapter-memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15

## [2.0.0-beta.14](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.13...adapter-memory-v2.0.0-beta.14) (2026-08-02)


### ⚠ BREAKING CHANGES

* pass caseSensitive directly in the execute options (sql/typeorm) and compileQuery/applyQuery options (memory); the visitor and filters wrappers are gone from those surfaces.

### Bug Fixes

* **adapters:** cross-backend drift fixes from the architecture audit ([#865](https://github.com/tada5hi/rapiq/issues/865)) ([d54c80f](https://github.com/tada5hi/rapiq/commit/d54c80f52e6f7996e18e9666c85f67cb50986792))


### Code Refactoring

* move the caseSensitive option to the top level everywhere ([#868](https://github.com/tada5hi/rapiq/issues/868)) ([d72f517](https://github.com/tada5hi/rapiq/commit/d72f51725dc80f800016938f894247cf301c5a42))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14

## [2.0.0-beta.13](https://github.com/tada5hi/rapiq/compare/adapter-memory-v2.0.0-beta.12...adapter-memory-v2.0.0-beta.13) (2026-07-28)


### ⚠ BREAKING CHANGES

* @rapiq/sql, @rapiq/typeorm, @rapiq/prisma and @rapiq/memory are now published as @rapiq/adapter-sql, @rapiq/adapter-typeorm, @rapiq/adapter-prisma and @rapiq/adapter-memory.

### Code Refactoring

* prefix backend packages with adapter- ([#858](https://github.com/tada5hi/rapiq/issues/858)) ([1f43ad4](https://github.com/tada5hi/rapiq/commit/1f43ad4b52dcea413e2004d8d17d4a09afcd2d02))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13

## [2.0.0-beta.12](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.11...memory-v2.0.0-beta.12) (2026-07-28)


### Miscellaneous Chores

* **memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12

## [2.0.0-beta.11](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.10...memory-v2.0.0-beta.11) (2026-07-27)


### Bug Fixes

* narrow an included relation to its per-relation fieldset ([#847](https://github.com/tada5hi/rapiq/issues/847)) ([#850](https://github.com/tada5hi/rapiq/issues/850)) ([bc6acef](https://github.com/tada5hi/rapiq/commit/bc6acefdb855a24af68d142e9e14010825794ca4))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11

## [2.0.0-beta.10](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.9...memory-v2.0.0-beta.10) (2026-07-26)


### Features

* condition-returning and batched key validation hooks ([#830](https://github.com/tada5hi/rapiq/issues/830)) ([#837](https://github.com/tada5hi/rapiq/issues/837)) ([ceda0b4](https://github.com/tada5hi/rapiq/commit/ceda0b4f6ef51f2ac1f68b17da1fa7f635d44532))
* **prisma:** add prisma adapter ([#838](https://github.com/tada5hi/rapiq/issues/838)) ([83c9c94](https://github.com/tada5hi/rapiq/commit/83c9c94db1d178b17798c9b106f99cdf027cfb65))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10

## [2.0.0-beta.9](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.8...memory-v2.0.0-beta.9) (2026-07-24)


### Miscellaneous Chores

* **memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9

## [2.0.0-beta.8](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.7...memory-v2.0.0-beta.8) (2026-07-24)


### Miscellaneous Chores

* **memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8

## [2.0.0-beta.7](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.6...memory-v2.0.0-beta.7) (2026-07-22)


### Features

* **memory:** accept ICondition in compileFilters ([#818](https://github.com/tada5hi/rapiq/issues/818)) ([65a4115](https://github.com/tada5hi/rapiq/commit/65a4115402a6eece0a7e59ef28e57b92c854122e))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7

## [2.0.0-beta.6](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.5...memory-v2.0.0-beta.6) (2026-07-21)


### Features

* first-class not() negation in the public condition IR ([#812](https://github.com/tada5hi/rapiq/issues/812)) ([d63e0a3](https://github.com/tada5hi/rapiq/commit/d63e0a33776e6d9ad8a8a16fde9423a6ad0ff3b5)), closes [#811](https://github.com/tada5hi/rapiq/issues/811)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6

## [2.0.0-beta.5](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.4...memory-v2.0.0-beta.5) (2026-07-21)


### Miscellaneous Chores

* **memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5

## [2.0.0-beta.4](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.3...memory-v2.0.0-beta.4) (2026-07-20)


### Miscellaneous Chores

* **memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4

## [2.0.0-beta.3](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.2...memory-v2.0.0-beta.3) (2026-07-20)


### Miscellaneous Chores

* **memory:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3

## [2.0.0-beta.2](https://github.com/tada5hi/rapiq/compare/memory-v2.0.0-beta.1...memory-v2.0.0-beta.2) (2026-07-20)


### Features

* **memory:** accept boolean for caseSensitive filter option ([#782](https://github.com/tada5hi/rapiq/issues/782)) ([96cbe60](https://github.com/tada5hi/rapiq/commit/96cbe60d2e8b709752c8d38dbcf03e2ff31ca31e)), closes [#775](https://github.com/tada5hi/rapiq/issues/775)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2

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
