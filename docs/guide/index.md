# What is it?

Hapiq (**H**TTP **API** **Q**uery) is a library to build an efficient interface between client- & server-side applications.
It defines a format for the request, but **not** for the response.

::: warning **Important NOTE**

The guide is under construction ☂ at the moment. So please stay patient or contribute to it, till it covers all parts ⭐.
:::


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
