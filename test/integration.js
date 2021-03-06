'use strict';
const chai = require('chai');
const assert = chai.assert;
const parquet = require('../parquet.js');

const TEST_NUM_ROWS = 10000;
const TEST_VTIME =  new Date();

// write a new file 'fruits.parquet'
async function writeTestFile(opts) {
  let schema = new parquet.ParquetSchema({
    name:       { type: 'UTF8', compression: opts.compression },
    quantity:   { type: 'INT64', optional: true, compression: opts.compression },
    price:      { type: 'DOUBLE', compression: opts.compression },
    date:       { type: 'TIMESTAMP_MICROS', compression: opts.compression },
    stock: {
      repeated: true,
      fields: {
        quantity: { type: 'INT64', repeated: true },
        warehouse: { type: 'UTF8', compression: opts.compression },
      }
    },
    colour:     { type: 'UTF8', repeated: true, compression: opts.compression },
    meta_json:  { type: 'BSON', optional: true, compression: opts.compression  },
  });

  let writer = await parquet.ParquetWriter.openFile(schema, 'fruits.parquet', opts);
  writer.setMetadata("myuid", "420");
  writer.setMetadata("fnord", "dronf");

  for (let i = 0; i < TEST_NUM_ROWS; ++i) {
    await writer.appendRow({
      name: 'apples',
      quantity: 10,
      price: 2.6,
      date: new Date(TEST_VTIME + 1000 * i),
      stock: [
        { quantity: 10, warehouse: "A" },
        { quantity: 20, warehouse: "B" }
      ],
      colour: [ 'green', 'red' ]
    });

    await writer.appendRow({
      name: 'oranges',
      quantity: 20,
      price: 2.7,
      date: new Date(TEST_VTIME + 2000 * i),
      stock: {
        quantity: [50, 75],
        warehouse: "X"
      },
      colour: [ 'orange' ]
    });

    await writer.appendRow({
      name: 'kiwi',
      price: 4.2,
      date: new Date(TEST_VTIME + 8000 * i),
      stock: [
        { quantity: 420, warehouse: "f" },
        { quantity: 20, warehouse: "x" }
      ],
      colour: [ 'green', 'brown' ],
      meta_json: { expected_ship_date: TEST_VTIME }
    });

    await writer.appendRow({
      name: 'banana',
      price: 3.2,
      date: new Date(TEST_VTIME + 6000 * i),
      colour: [ 'yellow' ],
      meta_json: { shape: 'curved' }
    });
  }

  await writer.close();
}

async function readTestFile() {
  let reader = await parquet.ParquetReader.openFile('fruits.parquet');
  assert.equal(reader.getRowCount(), TEST_NUM_ROWS * 4);
  assert.deepEqual(reader.getMetadata(), { "myuid": "420", "fnord": "dronf" })

  let schema = reader.getSchema();
  assert.equal(schema.fieldList.length, 9);
  assert(schema.fields.name);
  assert(schema.fields.stock);
  assert(schema.fields.stock.fields.quantity);
  assert(schema.fields.stock.fields.warehouse);
  assert(schema.fields.price);

  {
    const c = schema.fields.name;
    assert.equal(c.name, 'name');
    assert.equal(c.primitiveType, 'BYTE_ARRAY');
    assert.equal(c.originalType, 'UTF8');
    assert.deepEqual(c.path, ['name']);
    assert.equal(c.repetitionType, 'REQUIRED');
    assert.equal(c.encoding, 'PLAIN');
    assert.equal(c.compression, 'UNCOMPRESSED');
    assert.equal(c.rLevelMax, 0);
    assert.equal(c.dLevelMax, 0);
    assert.equal(!!c.isNested, false);
    assert.equal(c.fieldCount, undefined);
  }

  {
    const c = schema.fields.stock;
    assert.equal(c.name, 'stock');
    assert.equal(c.primitiveType, undefined);
    assert.equal(c.originalType, undefined);
    assert.deepEqual(c.path, ['stock']);
    assert.equal(c.repetitionType, 'REPEATED');
    assert.equal(c.encoding, undefined);
    assert.equal(c.compression, undefined);
    assert.equal(c.rLevelMax, 1);
    assert.equal(c.dLevelMax, 1);
    assert.equal(!!c.isNested, true);
    assert.equal(c.fieldCount, 2);
  }

  {
    const c = schema.fields.stock.fields.quantity;
    assert.equal(c.name, 'quantity');
    assert.equal(c.primitiveType, 'INT64');
    assert.equal(c.originalType, undefined);
    assert.deepEqual(c.path, ['stock', 'quantity']);
    assert.equal(c.repetitionType, 'REPEATED');
    assert.equal(c.encoding, 'PLAIN');
    assert.equal(c.compression, 'UNCOMPRESSED');
    assert.equal(c.rLevelMax, 2);
    assert.equal(c.dLevelMax, 2);
    assert.equal(!!c.isNested, false);
    assert.equal(c.fieldCount, undefined);
  }

  {
    const c = schema.fields.stock.fields.warehouse;
    assert.equal(c.name, 'warehouse');
    assert.equal(c.primitiveType, 'BYTE_ARRAY');
    assert.equal(c.originalType, 'UTF8');
    assert.deepEqual(c.path, ['stock', 'warehouse']);
    assert.equal(c.repetitionType, 'REQUIRED');
    assert.equal(c.encoding, 'PLAIN');
    assert.equal(c.compression, 'UNCOMPRESSED');
    assert.equal(c.rLevelMax, 1);
    assert.equal(c.dLevelMax, 1);
    assert.equal(!!c.isNested, false);
    assert.equal(c.fieldCount, undefined);
  }

  {
    const c = schema.fields.price;
    assert.equal(c.name, 'price');
    assert.equal(c.primitiveType, 'DOUBLE');
    assert.equal(c.originalType, undefined);
    assert.deepEqual(c.path, ['price']);
    assert.equal(c.repetitionType, 'REQUIRED');
    assert.equal(c.encoding, 'PLAIN');
    assert.equal(c.compression, 'UNCOMPRESSED');
    assert.equal(c.rLevelMax, 0);
    assert.equal(c.dLevelMax, 0);
    assert.equal(!!c.isNested, false);
    assert.equal(c.fieldCount, undefined);
  }

  {
    let cursor = reader.getCursor();
    for (let i = 0; i < TEST_NUM_ROWS; ++i) {
      assert.deepEqual(await cursor.next(), {
        name: 'apples',
        quantity: 10,
        price: 2.6,
        date: new Date(TEST_VTIME + 1000 * i),
        stock: [
          { quantity: [10], warehouse: "A" },
          { quantity: [20], warehouse: "B" }
        ],
        colour: [ 'green', 'red' ]
      });

      assert.deepEqual(await cursor.next(), {
        name: 'oranges',
        quantity: 20,
        price: 2.7,
        date: new Date(TEST_VTIME + 2000 * i),
        stock: [
          { quantity: [50, 75], warehouse: "X" }
        ],
        colour: [ 'orange' ]
      });

      assert.deepEqual(await cursor.next(), {
        name: 'kiwi',
        price: 4.2,
        date: new Date(TEST_VTIME + 8000 * i),
        stock: [
          { quantity: [420], warehouse: "f" },
          { quantity: [20], warehouse: "x" }
        ],
        colour: [ 'green', 'brown' ],
        meta_json: { expected_ship_date: TEST_VTIME }
      });

      assert.deepEqual(await cursor.next(), {
        name: 'banana',
        price: 3.2,
        date: new Date(TEST_VTIME + 6000 * i),
        colour: [ 'yellow' ],
        meta_json: { shape: 'curved' }
      });
    }

    assert.equal(await cursor.next(), null);
  }

  {
    let cursor = reader.getCursor(['name']);
    for (let i = 0; i < TEST_NUM_ROWS; ++i) {
      assert.deepEqual(await cursor.next(), { name: 'apples' });
      assert.deepEqual(await cursor.next(), { name: 'oranges' });
      assert.deepEqual(await cursor.next(), { name: 'kiwi' });
      assert.deepEqual(await cursor.next(), { name: 'banana' });
    }

    assert.equal(await cursor.next(), null);
  }

  {
    let cursor = reader.getCursor(['name', 'quantity']);
    for (let i = 0; i < TEST_NUM_ROWS; ++i) {
      assert.deepEqual(await cursor.next(), { name: 'apples', quantity: 10 });
      assert.deepEqual(await cursor.next(), { name: 'oranges', quantity: 20 });
      assert.deepEqual(await cursor.next(), { name: 'kiwi' });
      assert.deepEqual(await cursor.next(), { name: 'banana' });
    }

    assert.equal(await cursor.next(), null);
  }

  reader.close();
}

describe('Parquet', function() {
  this.timeout(60000);

  describe('with DataPageHeaderV1', function() {
    it('write a test file', function() {
      const opts = { useDataPageV2: false, compression: 'UNCOMPRESSED' };
      return writeTestFile(opts);
    });

    it('write a test file and then read it back', function() {
      const opts = { useDataPageV2: false, compression: 'UNCOMPRESSED' };
      return writeTestFile(opts).then(readTestFile);
    });
  });

  describe('with DataPageHeaderV2', function() {
    it('write a test file', function() {
      const opts = { useDataPageV2: true, compression: 'UNCOMPRESSED' };
      return writeTestFile(opts);
    });

    it('write a test file and then read it back', function() {
      const opts = { useDataPageV2: true, compression: 'UNCOMPRESSED' };
      return writeTestFile(opts).then(readTestFile);
    });

    it('write a test file with GZIP compression', function() {
      const opts = { useDataPageV2: true, compression: 'GZIP' };
      return writeTestFile(opts);
    });

    it('write a test file with GZIP compression and then read it back', function() {
      const opts = { useDataPageV2: true, compression: 'GZIP' };
      return writeTestFile(opts).then(readTestFile);
    });

    it('write a test file with SNAPPY compression', function() {
      const opts = { useDataPageV2: true, compression: 'SNAPPY' };
      return writeTestFile(opts);
    });

    it('write a test file with SNAPPY compression and then read it back', function() {
      const opts = { useDataPageV2: true, compression: 'SNAPPY' };
      return writeTestFile(opts).then(readTestFile);
    });

    //it('write a test file with LZO compression', function() {
    //  const opts = { useDataPageV2: true, compression: 'LZO' };
    //  return writeTestFile(opts);
    //});

    //it('write a test file with LZO compression and then read it back', function() {
    //  const opts = { useDataPageV2: true, compression: 'LZO' };
    //  return writeTestFile(opts).then(readTestFile);
    //});

    it('write a test file with BROTLI compression', function() {
      const opts = { useDataPageV2: true, compression: 'BROTLI' };
      return writeTestFile(opts);
    });

    it('write a test file with BROTLI compression and then read it back', function() {
      const opts = { useDataPageV2: true, compression: 'BROTLI' };
      return writeTestFile(opts).then(readTestFile);
    });
  });

});
