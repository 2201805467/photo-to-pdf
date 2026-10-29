const { test } = require('node:test');
const assert = require('node:assert/strict');
const { layout, safeFilename } = require('../converter.js');
const { jsPDF } = require('jspdf');
test('A4 preserves aspect ratio and centers images within margins', () => {
  const b = layout(1600, 900, 'a4', 'portrait', 10);
  assert.equal(b.pageWidth, 210); assert.equal(b.pageHeight, 297);
  assert.equal(b.x, 10); assert.equal(b.width, 190);
  assert.ok(Math.abs(b.width / b.height - 1600 / 900) < 1e-8);
  assert.ok(b.y >= 10 && b.y + b.height <= 287);
});
test('Letter landscape and original-size pages use correct dimensions', () => {
  const b = layout(100, 200, 'letter', 'landscape', 5);
  assert.equal(b.pageWidth, 279.4); assert.equal(b.pageHeight, 215.9);
  const original = layout(960, 480, 'image', 'portrait', 10);
  assert.equal(original.pageWidth, 274); assert.equal(original.pageHeight, 147);
  assert.equal(original.x, 10); assert.equal(original.y, 10);
});
test('file names retain Arabic and remove unsafe characters', () => {
  assert.equal(safeFilename(' صوري.pdf '), 'صوري.pdf');
  assert.equal(safeFilename('  '), 'صوري.pdf');
  assert.equal(safeFilename('a/b:c'), 'a_b_c.pdf');
});
test('PDF supports mixed page sizes and embedded images', () => {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pixels = { data: new Uint8ClampedArray([120, 180, 90, 255]), width: 1, height: 1 };
  pdf.addImage(pixels, 'RGBA', 10, 10, 20, 20);
  pdf.addPage([254, 127], 'landscape');
  assert.equal(pdf.getNumberOfPages(), 2);
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 254) < 0.01);
  assert.ok(pdf.output().startsWith('%PDF-'));
  assert.ok(pdf.output().includes('/Subtype /Image'));
});
