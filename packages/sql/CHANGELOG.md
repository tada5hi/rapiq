# Changelog

## [2.0.0-beta.9](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.8...sql-v2.0.0-beta.9) (2026-07-24)


### Miscellaneous Chores

* **sql:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9

## [2.0.0-beta.8](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.7...sql-v2.0.0-beta.8) (2026-07-24)


### Bug Fixes

* **typeorm:** hydrate included relations & allow json columns in fields ([#824](https://github.com/tada5hi/rapiq/issues/824)) ([#825](https://github.com/tada5hi/rapiq/issues/825)) ([6552d51](https://github.com/tada5hi/rapiq/commit/6552d518a755f27c0a3508e237a161050be67074))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8

## [2.0.0-beta.7](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.6...sql-v2.0.0-beta.7) (2026-07-22)


### Miscellaneous Chores

* **sql:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7

## [2.0.0-beta.6](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.5...sql-v2.0.0-beta.6) (2026-07-21)


### Features

* first-class not() negation in the public condition IR ([#812](https://github.com/tada5hi/rapiq/issues/812)) ([d63e0a3](https://github.com/tada5hi/rapiq/commit/d63e0a33776e6d9ad8a8a16fde9423a6ad0ff3b5)), closes [#811](https://github.com/tada5hi/rapiq/issues/811)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6

## [2.0.0-beta.5](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.4...sql-v2.0.0-beta.5) (2026-07-21)


### Miscellaneous Chores

* **sql:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5

## [2.0.0-beta.4](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.3...sql-v2.0.0-beta.4) (2026-07-20)


### Miscellaneous Chores

* **sql:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4

## [2.0.0-beta.3](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.2...sql-v2.0.0-beta.3) (2026-07-20)


### Miscellaneous Chores

* **sql:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3

## [2.0.0-beta.2](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.1...sql-v2.0.0-beta.2) (2026-07-20)


### Bug Fixes

* **sql:** let the backend decide whether a dotted prefix is a relation ([#787](https://github.com/tada5hi/rapiq/issues/787)) ([340f6e6](https://github.com/tada5hi/rapiq/commit/340f6e633eb0ced3e36e0850a29644e929a8ddfe)), closes [#779](https://github.com/tada5hi/rapiq/issues/779)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2

## [2.0.0-beta.1](https://github.com/tada5hi/rapiq/compare/sql-v2.0.0-beta.0...sql-v2.0.0-beta.1) (2026-07-19)


### Bug Fixes

* **typeorm:** resolve filter property paths to database column names ([eecb486](https://github.com/tada5hi/rapiq/commit/eecb4869a475571fab4c684f68359a78c3d474e3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1

## [2.0.0-beta.0](https://github.com/tada5hi/rapiq/compare/sql-v1.0.0...sql-v2.0.0-beta.0) (2026-07-17)


### ⚠ BREAKING CHANGES

* every elemMatch node now opens its own quantifier scope in @rapiq/memory - two elemMatches on one field (or an elemMatch beside a dotted sibling) bind independent elements (mongo semantics) instead of sharing one binding. $-prefixed keys are no longer accepted as field names in the build-layer filters object grammar. In the expression filter dialect, elemMatch is now a reserved keyword and $-prefixed words are reserved markers, so fields with these names no longer tokenize.
* the filters Validator type returns MaybeAsync<IFilter | undefined> (no void); relation aliases longer than 63 characters gain a hash suffix; TypeORM filter parameters are named rapiq_<n>_<i> instead of positional 0, 1, ...
* relation aliases now use length-prefixed path segments to avoid collisions.
* eq/ne/in/nin match strings case-insensitively on every adapter; previously case behavior followed the database collation (case-sensitive on postgres/sqlite/oracle and in @rapiq/memory).
* generated SQL aliases for nested relation paths are now path-qualified (role.realm joins as role_realm, not realm); pre-existing consumer joins for nested paths are only recognized under the path-qualified alias.
* **core:** the parameter node interfaces (IFields, IFilters, IPagination, IRelations, ISorts) gained merge (and, or on IFilters) methods; custom implementations must provide them. QueryBuilder is deprecated in favor of defineQuery.
* **typeorm:** relations now join with LEFT JOIN by default instead of INNER JOIN; records with absent relations are kept. Pass relations.joinType: 'inner' to restore the previous behavior.
* **sql:** null filter values now emit IS NULL predicates instead of bound parameters; the mssql preset no longer throws for anchored string operators and throws AdapterError (not Error) for regex.
* package rapiq renamed

### Features

* add ITSELF self-reference marker for element-level $elemMatch and $all ([#770](https://github.com/tada5hi/rapiq/issues/770)) ([e1d5c4c](https://github.com/tada5hi/rapiq/commit/e1d5c4c0f4c94bcde359aa92cc118cd773641c03))
* add size array-length filter operator ([#771](https://github.com/tada5hi/rapiq/issues/771)) ([013bf06](https://github.com/tada5hi/rapiq/commit/013bf06be06d1aef808f50e9a5dc922ab36f75ab))
* case-insensitive string equality with per-field opt-out ([#762](https://github.com/tada5hi/rapiq/issues/762)) ([5821c59](https://github.com/tada5hi/rapiq/commit/5821c593497a5c779d72dd0b4494cc36991284b1))
* codec package & intermediate representations (IR) ([#659](https://github.com/tada5hi/rapiq/issues/659)) ([b384624](https://github.com/tada5hi/rapiq/commit/b384624957f9861fa0959ef44b3522d06c4f8c20))
* **core:** typed build layer, condition helpers & query merge ([#747](https://github.com/tada5hi/rapiq/issues/747)) ([fd2fae7](https://github.com/tada5hi/rapiq/commit/fd2fae7d5b9611b0ff4633fa179dc527d98312aa))
* enhance typing with interfaces and lesser coupling ([#700](https://github.com/tada5hi/rapiq/issues/700)) ([60f00b5](https://github.com/tada5hi/rapiq/commit/60f00b5b229ec129b788458ea04f7b9b4896e0bc))
* **parser-mongo:** mongodb query parser dialect ([#751](https://github.com/tada5hi/rapiq/issues/751)) ([d96711b](https://github.com/tada5hi/rapiq/commit/d96711b4d1d482761433cc879220c3a51ce88474))
* replace interpreter with visitor pattern ([#668](https://github.com/tada5hi/rapiq/issues/668)) ([a9c4ae5](https://github.com/tada5hi/rapiq/commit/a9c4ae5f56de8e87da22176711bbc45ef8addb24))
* sql & typeorm package ([#638](https://github.com/tada5hi/rapiq/issues/638)) ([e461073](https://github.com/tada5hi/rapiq/commit/e4610737c03ff59807ad588aecf618b7af390dfc))
* **sql:** fragment assembly, null semantics, MSSQL LIKE fallback, typed adapter errors ([#741](https://github.com/tada5hi/rapiq/issues/741)) ([7a5e439](https://github.com/tada5hi/rapiq/commit/7a5e4391b6de2eace89d0103f48c4fd128f2a1d4))
* startsWith, endsWith & contains operator ([#675](https://github.com/tada5hi/rapiq/issues/675)) ([40bf127](https://github.com/tada5hi/rapiq/commit/40bf1278b7901f5a82f0516900bcca2eccc405dc))
* **typeorm:** dialect detection, left-join default, onJoin hook, idempotent joins, pagination echo ([#743](https://github.com/tada5hi/rapiq/issues/743)) ([f7c33c0](https://github.com/tada5hi/rapiq/commit/f7c33c0f061da651e9fc1a7aab0807f9101940db))


### Bug Fixes

* compound wrapping, anchored regex patterns, empty IN lists, sqlite preset ([#742](https://github.com/tada5hi/rapiq/issues/742)) ([6be65b4](https://github.com/tada5hi/rapiq/commit/6be65b4295d977a67047ee9203b6087a1ab2e9e7))
* harden filter validation and adapter state preservation ([#766](https://github.com/tada5hi/rapiq/issues/766)) ([97e11d4](https://github.com/tada5hi/rapiq/commit/97e11d450e8596d6a90869d30453f363add82bb9))
* harden v2 beta release ([#763](https://github.com/tada5hi/rapiq/issues/763)) ([51a906a](https://github.com/tada5hi/rapiq/commit/51a906aa1e5d9e8e4bd1e4dc0f9fce8ec4aaddeb))
* make query properties non optional ([8115b8f](https://github.com/tada5hi/rapiq/commit/8115b8f2fe4db46ed5c380f2b0179a624fe7fafb))
* path-qualify join aliases for nested relations ([#760](https://github.com/tada5hi/rapiq/issues/760)) ([7ea88f4](https://github.com/tada5hi/rapiq/commit/7ea88f47e5778b3a9e6dda091b7b0f579b4286fb))
* remove rootAlia param in buildField fn ([85e6fff](https://github.com/tada5hi/rapiq/commit/85e6fffd7283a7dcf83d65a655d287f20af78437))
* respect field operator in visitor ([3d32458](https://github.com/tada5hi/rapiq/commit/3d324588d81e367a3a7e944050bb54518e8526ce))
* **sql:** render negated filter operators null-inclusively ([#758](https://github.com/tada5hi/rapiq/issues/758)) ([374a2d9](https://github.com/tada5hi/rapiq/commit/374a2d9ba6cd013225b773f1fe583bb33a1af58b))
* typing & test suite ([5f7b2e7](https://github.com/tada5hi/rapiq/commit/5f7b2e78cf9825cbffb0a548b54e519f67a623be))


### Code Refactoring

* rename rapiq package to @rapiq/core ([#694](https://github.com/tada5hi/rapiq/issues/694)) ([89ffc31](https://github.com/tada5hi/rapiq/commit/89ffc31b8a31286213de5a890199d88fbe160313))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
  * peerDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
