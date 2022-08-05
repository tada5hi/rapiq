# hapiq 🌈

[![main](https://github.com/Tada5hi/hapiq/actions/workflows/main.yml/badge.svg)](https://github.com/Tada5hi/hapiq/actions/workflows/main.yml)
[![codecov](https://codecov.io/gh/Tada5hi/hapiq/branch/main/graph/badge.svg?token=ZUJ8F5TTSX)](https://codecov.io/gh/Tada5hi/hapiq)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/hapiq/badge.svg)](https://snyk.io/test/github/Tada5hi/hapiq)
[![npm version](https://badge.fury.io/js/hapiq.svg)](https://badge.fury.io/js/hapiq)

Hapiq (**H**TTP **API** **Q**uery) is a library to build an efficient interface between client- & server-side applications.
It defines a format for the request, but **not** for the response.

**Table of Contents**

- [Installation](#installation)
- [Documentation](#documentation)
- [Parameters](#parameters)

## Installation

```bash
npm install hapiq --save
```
## Documentation

To read the docs, visit [https://hapiq.tada5hi.net](https://hapiq.tada5hi.net)

## Parameters
- `fields`
    - Description: Return only specific fields or extend the default selection.
    - URL-Parameter: **fields**
- `filters`
    - Description: Filter the data set, according to specific criteria.
    - URL-Parameter: **filter**
- `relations`
    - Description: Include related resources of the primary data.
    - URL-Parameter: **include**
- `pagination`
    - Description: Limit the number of resources returned from the entire collection.
    - URL-Parameter: **page**
- `sort`
    - Description: Sort the resources according to one or more keys in asc/desc direction.
    - URL-Parameter: **sort**

It is based on the [JSON-API](https://jsonapi.org/format/) specification.

