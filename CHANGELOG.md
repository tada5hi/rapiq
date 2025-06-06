# [1.0.0](https://github.com/Tada5hi/rapiq/compare/v0.9.0...v1.0.0) (2025-04-22)


### Bug Fixes

* **deps:** bump smob from 1.4.0 to 1.4.1 ([#401](https://github.com/Tada5hi/rapiq/issues/401)) ([04f5545](https://github.com/Tada5hi/rapiq/commit/04f554598195e18cc853fcd2bd90adec4b97140a))
* **deps:** bump the minorandpatch group across 1 directory with 9 updates ([#562](https://github.com/Tada5hi/rapiq/issues/562)) ([06ff918](https://github.com/Tada5hi/rapiq/commit/06ff91890b91c28e8a62efe3edde3fd6f5893a19))
* remove ebec as dependency ([701e5dc](https://github.com/Tada5hi/rapiq/commit/701e5dc7bd4eade37515e901f8d4f9f419f21a6d))


### Features

* dedicated builder & parser class ([#566](https://github.com/Tada5hi/rapiq/issues/566)) ([94677b4](https://github.com/Tada5hi/rapiq/commit/94677b4fd5e2973f9625ba89c36b939f6566c931))
* initial parameter container(s) ([#481](https://github.com/Tada5hi/rapiq/issues/481)) ([1b3b5bf](https://github.com/Tada5hi/rapiq/commit/1b3b5bf03bcd4fe45924a09320d63c2d806b0966))
* remove parse-query-paramter fn ([669cee0](https://github.com/Tada5hi/rapiq/commit/669cee07c3d7cd592d3cafb84a6f52ea67531722))
* simplify parsing & refactored typings ([#471](https://github.com/Tada5hi/rapiq/issues/471)) ([cc336b7](https://github.com/Tada5hi/rapiq/commit/cc336b7dbac2c094d0c22d8ce1ffa117de321006))


### BREAKING CHANGES

* parseQueryParameter fn removed

* docs: updated documentation

* build: downgraded semantic-release to v22.x

* build: bump rollup and swc
* parseQueryParameter fn removed

# [0.9.0](https://github.com/Tada5hi/rapiq/compare/v0.8.1...v0.9.0) (2023-07-04)


### Bug Fixes

* refactoring bug of throwOnFailure option ([a555b2d](https://github.com/Tada5hi/rapiq/commit/a555b2d2e97dc33b35a5bd3b0bbdb2f9fdaab348))


### Features

* allow throwing error on invalid parsing input ([#312](https://github.com/Tada5hi/rapiq/issues/312)) ([3afd7f2](https://github.com/Tada5hi/rapiq/commit/3afd7f218402738a57f8b2c0bf241b2399024164))

## [0.8.1](https://github.com/Tada5hi/rapiq/compare/v0.8.0...v0.8.1) (2023-05-29)


### Bug Fixes

* apply defaults if parse input has no parameter keys ([c4ba303](https://github.com/Tada5hi/rapiq/commit/c4ba3036da2b4c5bbd02411f8f54787bc7e90953))
* **deps:** bump smob to v1.x ([978da3a](https://github.com/Tada5hi/rapiq/commit/978da3adfe399749b4afb91d901b84cc736641c7))
* simplify build query string util ([7e7eb28](https://github.com/Tada5hi/rapiq/commit/7e7eb28372900f4c2c09a99460dfa179fe49b837))
* use custom merger for parameters ([4ff0ca5](https://github.com/Tada5hi/rapiq/commit/4ff0ca5fc18065c515090d01e87244f1a9fbba10))

# [0.8.0](https://github.com/Tada5hi/rapiq/compare/v0.7.0...v0.8.0) (2023-02-14)


### Features

* enhance parsing of parameters ([2cc8b4d](https://github.com/Tada5hi/rapiq/commit/2cc8b4df6dcaf1ee8feb35037a2def1426c46193))

# [0.7.0](https://github.com/Tada5hi/rapiq/compare/v0.6.6...v0.7.0) (2023-01-27)


### Features

* refactor build pipeline & replaced babel with swc ([a3dcc53](https://github.com/Tada5hi/rapiq/commit/a3dcc53d60164d0950221bdaa6ed9eacfa8d9c60))

## [0.6.6](https://github.com/Tada5hi/rapiq/compare/v0.6.5...v0.6.6) (2023-01-18)


### Bug Fixes

* avoid nullish coalescing operator ([2f98bc1](https://github.com/Tada5hi/rapiq/commit/2f98bc18c5714732b4e234776f1a8b7aab372a71))

## [0.6.5](https://github.com/Tada5hi/rapiq/compare/v0.6.4...v0.6.5) (2023-01-18)


### Bug Fixes

* removed minimatch + replaced babel with esbuild for transpiling ([3b6744d](https://github.com/Tada5hi/rapiq/commit/3b6744db4d7808633cb326ab4adf0a1e6bb5b870))

## [0.6.4](https://github.com/Tada5hi/rapiq/compare/v0.6.3...v0.6.4) (2023-01-17)


### Bug Fixes

* **deps:** bump minimatch from 5.1.2 to 6.0.4 ([6113e42](https://github.com/Tada5hi/rapiq/commit/6113e429527d99ecb06c77d1dd120a8ee1e8ff4a))
* **deps:** bump smob from 0.0.6 to 0.0.7 ([40ae989](https://github.com/Tada5hi/rapiq/commit/40ae98952ee784b701e3637cb041220923646a7d))

## [0.6.3](https://github.com/Tada5hi/rapiq/compare/v0.6.2...v0.6.3) (2023-01-04)


### Bug Fixes

* **deps:** bump json5 from 1.0.1 to 1.0.2 ([dfede3d](https://github.com/Tada5hi/rapiq/commit/dfede3d9f2b0e15e90f47001842cb58ab94945c9))

## [0.6.2](https://github.com/Tada5hi/rapiq/compare/v0.6.1...v0.6.2) (2022-12-22)


### Bug Fixes

* **deps:** bump minimatch from 5.1.1 to 5.1.2 ([6c3cf63](https://github.com/Tada5hi/rapiq/commit/6c3cf634670c21fc0f96deb84c066e887b7091bf))

## [0.6.1](https://github.com/Tada5hi/rapiq/compare/v0.6.0...v0.6.1) (2022-11-30)


### Bug Fixes

* **deps:** bump minimatch from 5.1.0 to 5.1.1 ([d1e3852](https://github.com/Tada5hi/rapiq/commit/d1e3852c40055a8f82e29427460f3140dac03970))

# [0.6.0](https://github.com/Tada5hi/rapiq/compare/v0.5.0...v0.6.0) (2022-11-28)


### Features

* add esm support ([9986da1](https://github.com/Tada5hi/rapiq/commit/9986da15cc7ff120f289264ba163fafa163a1076))

# [0.5.0](https://github.com/Tada5hi/rapiq/compare/v0.4.1...v0.5.0) (2022-11-27)


### Features

* allow null value in filter list ([a264d6c](https://github.com/Tada5hi/rapiq/commit/a264d6cce4e43bb0543b2f57d32a34b1bee04f4d))

## [0.4.1](https://github.com/Tada5hi/rapiq/compare/v0.4.0...v0.4.1) (2022-10-28)


### Bug Fixes

* allow enable/disable parameter parsing by boolean for parseQuery ([2b29f41](https://github.com/Tada5hi/rapiq/commit/2b29f41ed17ff1cd93b5b60ad0deedd92cc1ee41))

# [0.4.0](https://github.com/Tada5hi/rapiq/compare/v0.3.2...v0.4.0) (2022-10-28)


### Bug Fixes

* allow non matching regex strings, if permitted by options ([145b119](https://github.com/Tada5hi/rapiq/commit/145b1199b79f5dc33893bca32e110ec2d7700985))


### Features

* parse everything, if allowed- & default- option are not defined ([9bda36a](https://github.com/Tada5hi/rapiq/commit/9bda36a4fa0619952b0e9375c8e8b3365ba34df4))

## [0.3.2](https://github.com/Tada5hi/rapiq/compare/v0.3.1...v0.3.2) (2022-10-27)


### Bug Fixes

* only inherit default-path for defined options ([454b54a](https://github.com/Tada5hi/rapiq/commit/454b54add0cd61e03f7968cc5700d7b24b825b47))

## [0.3.1](https://github.com/Tada5hi/rapiq/compare/v0.3.0...v0.3.1) (2022-10-22)


### Bug Fixes

* cleanup types + support more filter input values ([1c0e59f](https://github.com/Tada5hi/rapiq/commit/1c0e59f4981b1b2ce6b2d671f670243486719142))

# [0.3.0](https://github.com/Tada5hi/rapiq/compare/v0.2.9...v0.3.0) (2022-10-21)


### Bug Fixes

* changed structure of filters-parse-output-element ([0f3ec4e](https://github.com/Tada5hi/rapiq/commit/0f3ec4e98abd740762f07d5c6fbb518f4da5abe9))
* filter-value-with-operator type ([acbc090](https://github.com/Tada5hi/rapiq/commit/acbc0908febd2e66c52368dc199734fd0008033e))
* remove filter-value-config format ([a7172b0](https://github.com/Tada5hi/rapiq/commit/a7172b00d1cdc28ba22f0b6555a69f134c2d8321))


### Features

* add filter validate option ([882a5dc](https://github.com/Tada5hi/rapiq/commit/882a5dcb58ecd5cb57a7e4f5326b9e6a528a1194))

## [0.2.9](https://github.com/Tada5hi/rapiq/compare/v0.2.8...v0.2.9) (2022-10-21)


### Bug Fixes

* example in README.md & bump version ([521fed8](https://github.com/Tada5hi/rapiq/commit/521fed8fda810d5dc1487db7c7a97962ea3baa0a))

## [0.2.8](https://github.com/Tada5hi/rapiq/compare/v0.2.7...v0.2.8) (2022-10-21)


### Bug Fixes

* typing for parse-query & parse-query-parameter ([1924ea7](https://github.com/Tada5hi/rapiq/commit/1924ea7969fb8cf1d4ceabe49fbe215706797238))

## [0.2.7](https://github.com/Tada5hi/rapiq/compare/v0.2.6...v0.2.7) (2022-10-21)


### Bug Fixes

* add generic argument for parse-query function ([ac0e89f](https://github.com/Tada5hi/rapiq/commit/ac0e89f331b479d520aa345219c8dce9471c5eeb))

## [0.2.6](https://github.com/Tada5hi/rapiq/compare/v0.2.5...v0.2.6) (2022-10-20)


### Bug Fixes

* applying default fields with alias ([177f5cd](https://github.com/Tada5hi/rapiq/commit/177f5cd1cd25d63388bcddad173341811eb05f2c))
* length comparision for key with alias ([0ebf707](https://github.com/Tada5hi/rapiq/commit/0ebf7071369e4b6297213ecfbb95c4fa89fa3171))

## [0.2.5](https://github.com/Tada5hi/rapiq/compare/v0.2.4...v0.2.5) (2022-10-20)


### Bug Fixes

* add missing generic type argument for parameters ([01f1065](https://github.com/Tada5hi/rapiq/commit/01f1065fffcf3c0a3a753793d3c67ccf32d71a30))

## [0.2.4](https://github.com/Tada5hi/rapiq/compare/v0.2.3...v0.2.4) (2022-10-19)


### Bug Fixes

* add Date type as allowed simple key ([44fa46e](https://github.com/Tada5hi/rapiq/commit/44fa46edb7c2f12a6fb6510e26eac7f291eebcf6))

## [0.2.3](https://github.com/Tada5hi/rapiq/compare/v0.2.2...v0.2.3) (2022-10-19)


### Bug Fixes

* updated smob dependency ([2f0ca15](https://github.com/Tada5hi/rapiq/commit/2f0ca15a3f9a4db60ae8d9ad5ab409442d55c3b1))

## [0.2.2](https://github.com/Tada5hi/rapiq/compare/v0.2.1...v0.2.2) (2022-10-19)


### Bug Fixes

* allow global default-path for parse-query method ([2580bb9](https://github.com/Tada5hi/rapiq/commit/2580bb930ec40cd1550d67fbf20a9e88bdca9505))

## [0.2.1](https://github.com/Tada5hi/rapiq/compare/v0.2.0...v0.2.1) (2022-10-18)


### Bug Fixes

* parse query relations typing and allowed matching ([b60f9f4](https://github.com/Tada5hi/rapiq/commit/b60f9f4649a2353534e1279a2c50f08dec64c53a))

# [0.2.0](https://github.com/Tada5hi/rapiq/compare/v0.1.1...v0.2.0) (2022-10-18)


### Features

* backported defaultAlias as defaultPath ([82f820c](https://github.com/Tada5hi/rapiq/commit/82f820cf1ce4425765795be0a859a39c5a838493))

## [0.1.1](https://github.com/Tada5hi/rapiq/compare/v0.1.0...v0.1.1) (2022-10-18)


### Bug Fixes

* filter array value transformation + removed unnecessary methods ([a02767a](https://github.com/Tada5hi/rapiq/commit/a02767a5149fd0088a83a6b97035dc30badd5b41))
* query parameter building + enhanced generation ([40d56c4](https://github.com/Tada5hi/rapiq/commit/40d56c438c25c4a35fdef1a6b3c2ab72e02ebdf7))

# [0.1.0](https://github.com/Tada5hi/rapiq/compare/v0.0.6...v0.1.0) (2022-10-15)


### Bug Fixes

* transform filter output value + enhanced typing for filter(s) ([cb4cafb](https://github.com/Tada5hi/rapiq/commit/cb4cafb9c9a92c1ccd2cc40d4a0f5bcd3ea06c3a))


### Features

* add default & default-by-element option for filter(s) parsing ([c2e552d](https://github.com/Tada5hi/rapiq/commit/c2e552d51a5c588a3eb53263863be30f80ea9aa7))
* allow specifying default sort column(s) for parsing ([0029731](https://github.com/Tada5hi/rapiq/commit/00297318c6798520f2e8595541ad2f920d03b8c3))

## [0.0.6](https://github.com/Tada5hi/rapiq/compare/v0.0.5...v0.0.6) (2022-10-10)


### Bug Fixes

* specify depedanbot commit message + bump version ([9c70aaf](https://github.com/Tada5hi/rapiq/commit/9c70aaf1f39aacc0b2aee0292ce576fe359b9edb))

## [0.0.5](https://github.com/Tada5hi/rapiq/compare/v0.0.4...v0.0.5) (2022-10-10)


### Bug Fixes

* sort build input type + updated package.json ([5177fb9](https://github.com/Tada5hi/rapiq/commit/5177fb90d0fa65203ec87246f4b6cf7238fa59aa))
