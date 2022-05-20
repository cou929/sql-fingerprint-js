export default function fingerprint(sql, matchMD5Checksum, matchEmbeddedNumbers) {
  let query = sql;

  // special cases
  if (/^SELECT \/\*!40001 SQL_NO_CACHE \*\/ \* FROM `/.test(query)) {
    return 'mysqldump';
  }
  if (/\/\*\w+\.\w+:[0-9]\/[0-9]\*\//.test(query)) {
    return 'percona-toolkit';
  }
  if (/^administrator command: /.test(query)) {
    return query;
  }
  const matchedCallStatement = query.match(/^\s*(call\s+\S+)\(/i);
  if (matchedCallStatement) {
    return matchedCallStatement[1].toLowerCase();
  }

  // shorten multi-value INSERT statement
  const matchedMultiValueInsert = query.match(/^((?:INSERT|REPLACE)(?: IGNORE)?\s+INTO.+?VALUES\s*\(.*?\))\s*,\s*\(/is);
  if (matchedMultiValueInsert) {
    // eslint-disable-next-line prefer-destructuring
    query = matchedMultiValueInsert[1];
  }

  // multi line comment
  query = query.replace(/\/\*[^!].*?\*\//g, '');

  // one_line_comment
  query = query.replace(/(?:--|#)[^'"\r\n]*(?=[\r\n]|$)/g, '');

  // USE statement
  if (/^use \S+$/i.test(query)) {
    return 'use ?';
  }

  // literals
  query = query.replace(/([^\\])(\\')/sg, '$1');
  query = query.replace(/([^\\])(\\")/sg, '$1');
  query = query.replace(/\\\\/sg, '');
  query = query.replace(/\\'/sg, '');
  query = query.replace(/\\"/sg, '');
  query = query.replace(/([^\\])(".*?[^\\]?")/sg, '$1?');
  query = query.replace(/([^\\])('.*?[^\\]?')/sg, '$1?');

  query = query.replace(/\bfalse\b|\btrue\b/isg, '?');

  if (matchMD5Checksum) {
    query = query.replace(/([._-])[a-f0-9]{32}/g, '$1?');
  }

  if (!matchEmbeddedNumbers) {
    query = query.replace(/[0-9+-][0-9a-f.xb+-]*/g, '?');
  } else {
    query = query.replace(/\b[0-9+-][0-9a-f.xb+-]*/g, '?');
  }

  if (matchMD5Checksum) {
    query = query.replace(/[xb+-]\?/g, '?');
  } else {
    query = query.replace(/[xb.+-]\?/g, '?');
  }

  // collapse whitespace
  query = query.replace(/^\s+/, '');
  query = query.replace(/[\r\n]+$/, '');
  query = query.replace(/[ \n\t\r\f]+/g, ' ');

  // to lower case
  query = query.toLowerCase();

  // get rid of null
  query = query.replace(/\bnull\b/g, '?');

  // collapse IN and VALUES lists
  query = query.replace(/\b(in|values?)(?:[\s,]*\([\s?,]*\))+/g, '$1(?+)');

  // collapse UNION
  query = query.replace(/\b(select\s.*?)(?:(\sunion(?:\sall)?)\s\1)+/g, '$1 /*repeat$2*/');

  // limit
  query = query.replace(/\blimit \?(?:, ?\?| offset \?)?/, 'limit ?');

  // order by
  query = query.replace(/\b(.+?)\s+ASC/gi, '$1');

  return query;
}
