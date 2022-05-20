// eslint-disable-next-line import/no-unresolved
import test from 'node:test';
import assert from 'assert';
// eslint-disable-next-line import/extensions
import fingerprint from './fingerprint.js';

test('fingerprint', async (t) => {
  await t.test('complex comments', () => {
    assert.strictEqual(
      fingerprint("UPDATE groups_search SET  charter = '   -------3\\'\\' XXXXXXXXX.\n    \n    -----------------------------------------------------', show_in_list = 'Y' WHERE group_id='aaaaaaaa'"),
      'update groups_search set charter = ?, show_in_list = ? where group_id=?',
    );
  });

  await t.test('Fingerprints all mysqldump SELECTs together', () => {
    assert.strictEqual(
      fingerprint('SELECT /*!40001 SQL_NO_CACHE */ * FROM `film`'),
      'mysqldump',
    );
  });

  await t.test('Fingerprints admin commands as themselves', () => {
    assert.strictEqual(
      fingerprint('CALL foo(1, 2, 3)'),
      'call foo',
    );
  });

  await t.test('Fingerprints stored procedure calls specially', () => {
    assert.strictEqual(
      fingerprint('administrator command: Init DB'),
      'administrator command: Init DB',
    );
  });

  await t.test('Fingerprints mk-table-checksum queries together', () => {
    const input = `
REPLACE /*foo.bar:3/3*/ INTO checksum.checksum (db, tbl,
chunk, boundaries, this_cnt, this_crc) SELECT 'foo', 'bar',
2 AS chunk_num, '\`id\` >= 2166633', COUNT(*) AS cnt,
LOWER(CONV(BIT_XOR(CAST(CRC32(CONCAT_WS('#', \`id\`, \`created_by\`,
\`created_date\`, \`updated_by\`, \`updated_date\`, \`ppc_provider\`,
\`account_name\`, \`provider_account_id\`, \`campaign_name\`,
\`provider_campaign_id\`, \`adgroup_name\`, \`provider_adgroup_id\`,
\`provider_keyword_id\`, \`provider_ad_id\`, \`foo\`, \`reason\`,
\`foo_bar_bazz_id\`, \`foo_bar_baz\`, CONCAT(ISNULL(\`created_by\`),
ISNULL(\`created_date\`), ISNULL(\`updated_by\`), ISNULL(\`updated_date\`),
ISNULL(\`ppc_provider\`), ISNULL(\`account_name\`),
ISNULL(\`provider_account_id\`), ISNULL(\`campaign_name\`),
ISNULL(\`provider_campaign_id\`), ISNULL(\`adgroup_name\`),
ISNULL(\`provider_adgroup_id\`), ISNULL(\`provider_keyword_id\`),
ISNULL(\`provider_ad_id\`), ISNULL(\`foo\`), ISNULL(\`reason\`),
ISNULL(\`foo_base_foo_id\`), ISNULL(\`fooe_foo_id\`)))) AS UNSIGNED)), 10,
16)) AS crc FROM \`foo\`.\`bar\` USE INDEX (\`PRIMARY\`) WHERE
(\`id\` >= 2166633);
      `;
    assert.strictEqual(
      fingerprint(input),
      'percona-toolkit',
    );
  });

  await t.test('Removes identifier from USE', () => {
    assert.strictEqual(
      fingerprint('use `foo`'),
      'use ?',
    );
  });

  await t.test('Removes one-line comments in fingerprints', () => {
    assert.strictEqual(
      fingerprint('select \n--bar\n foo'),
      'select foo',
    );
  });

  await t.test('Removes one-line comments in fingerprint without mushing things together', () => {
    assert.strictEqual(
      fingerprint('select foo--bar\nfoo'),
      'select foo foo',
    );
  });

  await t.test('Removes one-line EOL comments in fingerprints', () => {
    assert.strictEqual(
      fingerprint('select foo -- bar\n'),
      'select foo ',
    );
  });

  await t.test('Handles bug from perlmonks thread 728718', () => {
    assert.strictEqual(
      fingerprint('select null, 5.001, 5001. from foo'),
      'select ?, ?, ? from foo',
    );
  });

  await t.test('Handles quoted strings', () => {
    assert.strictEqual(
      fingerprint("select 'hello', '\nhello\n', \"hello\", '\\'' from foo"),
      'select ?, ?, ?, ? from foo',
    );
  });

  await t.test('Handles trailing newline', () => {
    assert.strictEqual(
      fingerprint("select 'hello'\n"),
      'select ?',
    );
  });

  await t.test('Does not handle all quoted strings', () => {
    assert.strictEqual(
      fingerprint("select '\\\\' from foo"),
      'select ? from foo',
    );
  });

  await t.test('Collapses whitespace', () => {
    assert.strictEqual(
      fingerprint('select   foo'),
      'select foo',
    );
  });

  await t.test('Lowercases, replaces integer', () => {
    assert.strictEqual(
      fingerprint('SELECT * from foo where a = 5'),
      'select * from foo where a = ?',
    );
  });

  await t.test('Floats', () => {
    assert.strictEqual(
      fingerprint('select 0e0, +6e-30, -6.00 from foo where a = 5.5 or b=0.5 or c=.5'),
      'select ?, ?, ? from foo where a = ? or b=? or c=?',
    );
  });

  await t.test('Hex/bit', () => {
    assert.strictEqual(
      fingerprint("select 0x0, x'123', 0b1010, b'10101' from foo"),
      'select ?, ?, ?, ? from foo',
    );
  });

  await t.test('Collapses whitespace', () => {
    assert.strictEqual(
      fingerprint(' select  * from\nfoo where a = 5'),
      'select * from foo where a = ?',
    );
  });

  await t.test('IN lists', () => {
    assert.strictEqual(
      fingerprint('select * from foo where a in (5) and b in (5, 8,9 ,9 , 10)'),
      'select * from foo where a in(?+) and b in(?+)',
    );
  });

  await t.test('Numeric table names', () => {
    assert.strictEqual(
      fingerprint('select foo_1 from foo_2_3'),
      'select foo_? from foo_?_?',
    );
  });

  await t.test('Numeric table name prefixes', () => {
    assert.strictEqual(
      fingerprint('select 123foo from 123foo'),
      'select ?oo from ?oo',
    );
  });

  await t.test('Numeric table name prefixes with underscores', () => {
    assert.strictEqual(
      fingerprint('select 123_foo from 123_foo'),
      'select ?_foo from ?_foo',
    );
  });

  await t.test('A string that needs no changes', () => {
    assert.strictEqual(
      fingerprint('insert into abtemp.coxed select foo.bar from foo'),
      'insert into abtemp.coxed select foo.bar from foo',
    );
  });

  await t.test('VALUES lists', () => {
    assert.strictEqual(
      fingerprint('insert into foo(a, b, c) values(2, 4, 5)'),
      'insert into foo(a, b, c) values(?+)',
    );
  });

  await t.test('VALUES lists with multiple ()', () => {
    assert.strictEqual(
      fingerprint('insert into foo(a, b, c) values(2, 4, 5) , (2,4,5)'),
      'insert into foo(a, b, c) values(?+)',
    );
  });

  await t.test('VALUES lists with VALUE()', () => {
    assert.strictEqual(
      fingerprint('insert into foo(a, b, c) value(2, 4, 5)'),
      'insert into foo(a, b, c) value(?+)',
    );
  });

  await t.test('limit alone', () => {
    assert.strictEqual(
      fingerprint('select * from foo limit 5'),
      'select * from foo limit ?',
    );
  });

  await t.test('limit with comma-offset', () => {
    assert.strictEqual(
      fingerprint('select * from foo limit 5, 10'),
      'select * from foo limit ?',
    );
  });

  await t.test('limit with offset', () => {
    assert.strictEqual(
      fingerprint('select * from foo limit 5 offset 10'),
      'select * from foo limit ?',
    );
  });

  await t.test('union fingerprints together', () => {
    assert.strictEqual(
      fingerprint('select 1 union select 2 union select 4'),
      'select ? /*repeat union*/',
    );
  });

  await t.test('union all fingerprints together', () => {
    assert.strictEqual(
      fingerprint('select 1 union all select 2 union all select 4'),
      'select ? /*repeat union all*/',
    );
  });

  await t.test('union all fingerprints together', () => {
    assert.strictEqual(
      fingerprint('select * from (select 1 union all select 2 union all select 4) as x join (select 2 union select 2 union select 3) as y'),
      'select * from (select ? /*repeat union all*/) as x join (select ? /*repeat union*/) as y',
    );
  });

  await t.test('Remove ASC from ORDER BY', () => {
    assert.strictEqual(
      fingerprint('select c from t where i=1 order by c asc'),
      'select c from t where i=? order by c',
    );
  });

  await t.test('Remove only ASC from ORDER BY', () => {
    assert.strictEqual(
      fingerprint('select * from t where i=1 order by a, b ASC, d DESC, e asc'),
      'select * from t where i=? order by a, b, d desc, e',
    );
  });

  const multiLineInput = `select * from t where i=1      order            by 
  a,  b          ASC, d    DESC,    
                        
                        e asc`;
  await t.test('Remove ASC from spacey ORDER BY', () => {
    assert.strictEqual(
      fingerprint(multiLineInput),
      'select * from t where i=? order by a, b, d desc, e',
    );
  });

  await t.test('Fingerprint db.MD5_tbl', () => {
    assert.strictEqual(
      fingerprint('SELECT * FROM db.fbc5e685a5d3d45aa1d0347fdb7c4d35_temp where id=1', true),
      'select * from db.?_temp where id=?',
    );
  });

  await t.test('Fingerprint db.tbl_MD5', () => {
    assert.strictEqual(
      fingerprint('SELECT * FROM db.temp_fbc5e685a5d3d45aa1d0347fdb7c4d35 where id=1', true),
      'select * from db.temp_? where id=?',
    );
  });

  await t.test('Fingerprint db.MD5_tbl (with match_embedded_numbers)', () => {
    assert.strictEqual(
      fingerprint('SELECT * FROM db.fbc5e685a5d3d45aa1d0347fdb7c4d35_temp where id=1', true, true),
      'select * from db.?_temp where id=?',
    );
  });

  await t.test('Fingerprint db.tbl_MD5 (with match_embedded_numbers)', () => {
    assert.strictEqual(
      fingerprint('SELECT * FROM db.temp_fbc5e685a5d3d45aa1d0347fdb7c4d35 where id=1', true, true),
      'select * from db.temp_? where id=?',
    );
  });

  await t.test('Fingerprint db.tbl<number>name (preserve number)', () => {
    assert.strictEqual(
      fingerprint('SELECT * FROM prices.rt_5min where id=1', false, true),
      'select * from prices.rt_5min where id=?',
    );
  });

  await t.test('Fingerprint /* -- comment */ SELECT (bug 1174956)', () => {
    assert.strictEqual(
      fingerprint('/* -- S++ SU ABORTABLE -- spd_user: rspadim */SELECT SQL_SMALL_RESULT SQL_CACHE DISTINCT centro_atividade FROM est_dia WHERE unidade_id=1001 AND item_id=67 AND item_id_red=573', false, true),
      'select sql_small_result sql_cache distinct centro_atividade from est_dia where unidade_id=? and item_id=? and item_id_red=?',
    );
  });

  await t.test('boolean values abstracted correctly', () => {
    assert.strictEqual(
      fingerprint('SELECT * FROM tbl WHERE id=1 AND flag=true AND trueflag=FALSE', false, true),
      'select * from tbl where id=? and flag=? and trueflag=?',
    );
  });
});
