(function (root) {
  'use strict';
  function layout(width, height, size, orientation, margin) {
    let pageWidth, pageHeight;
    if (size === 'image') {
      pageWidth = width * 25.4 / 96 + margin * 2;
      pageHeight = height * 25.4 / 96 + margin * 2;
    } else {
      [pageWidth, pageHeight] = size === 'letter' ? [215.9, 279.4] : [210, 297];
      if (orientation === 'landscape') [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }
    const scale = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
    return { pageWidth, pageHeight, width: width * scale, height: height * scale,
      x: (pageWidth - width * scale) / 2, y: (pageHeight - height * scale) / 2 };
  }
  function safeFilename(value) {
    return (value.trim().replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '') || 'صوري') + '.pdf';
  }
  const api = { layout, safeFilename };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PdfTools = api;
})(typeof window !== 'undefined' ? window : globalThis);
