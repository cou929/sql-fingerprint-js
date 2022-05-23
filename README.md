# sql-fingerprint

Converts a SQL into a fingerprint, the abstracted form of a query, which makes it possible to classify similar queries.

Actually, this module is a JavaScript port of [pt-fingerprint](https://www.percona.com/doc/percona-toolkit/LATEST/pt-fingerprint.html). Therefore is primarily intended to use for MySQL queries.

## Description

The fingerprint is the abstracted form of a query. What "abstracting query" is string conversion such that, for instance, replace values to `?`, collapse whitespaces and so on.

Let's say that there are such queries:

```sql
SELECT * FROM t WHERE i = 1 ORDER BY a, b ASC, d DESC, e ASC;

select *         from t       where i = 1
 order by a, b ASC, d DESC, e asc;
```

A fingerprint of both of these will be below:

```sql
select * from t where i = ? order by a, b, d desc, e;
```

## Usage

### CLI

```sh
npm install -g sql-fingerprint

fingerprint --query="your query"
```

### Module

```sh
npm install sql-fingerprint
```

```js
import fingerprint from 'sql-fingerprint';

console.log(fingerprint('SELECT * FROM users WHERE id = 1', false, false));
```

### BigQuery UDF

The initial motivation I wrote this was that classifies similar queries stored in my dataset of BigQuery. BigQuery supports [user-defined functions written in JavaScript](https://cloud.google.com/bigquery/docs/reference/standard-sql/user-defined-functions#javascript-udf-structure). Therefore the approach of pt-fingerprint, which is generate fingerprint by a set of RegExps, is more fit than other approaches such as parsing SQL, building AST and then interpreting it. RegExps approach seems a little bit harder to maintain but easier to use as UDF because of the relatively simple source code.

```sql
CREATE TEMP FUNCTION fingerprint(sql STRING, matchMD5Checksum BOOL, matchEmbeddedNumbers BOOL)
RETURNS STRING
LANGUAGE js AS r"""

  // copy and paste fingerprint function here from fingerprint.js
  // ...

  return query;
""";

SELECT
  fingerprint(textPayload, true, true) fp,
  count(*) as num,
  max(query) as raw_query_sample
FROM
  `your_table`
WHERE
  DATE(timestamp, "Asia/Tokyo") = "2022-05-22"
group by
  fp
order by
  num desc
```

See also: [Standard SQL user\-defined functions  \|  BigQuery  \|  Google Cloud](https://cloud.google.com/bigquery/docs/reference/standard-sql/user-defined-functions#javascript-udf-structure)
