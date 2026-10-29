'use strict';
const $ = id => document.getElementById(id);
const images = [];
const maxImages = 30;
let loading = false;
let converting = false;
function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
  $('status').hidden = !message;
}
function refresh() {
  $('collection').hidden = images.length === 0;
  $('drop-zone').hidden = images.length > 0;
  $('image-count').textContent = images.length;
  $('page-count').textContent = images.length === 1 ? 'صفحة واحدة' : `${images.length} صفحات`;
  $('convert').disabled = !images.length || loading || converting;
  $('choose-files').disabled = loading || converting;
  $('add-more').disabled = loading || converting;
  $('clear-all').disabled = loading || converting;
  $('image-grid').replaceChildren();
  images.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'image-card';
    const preview = document.createElement('div');
    preview.className = 'thumbnail';
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.file.name;
    img.style.transform = `rotate(${item.rotation}deg)`;
    const badge = document.createElement('span');
    badge.className = 'page-number';
    badge.textContent = index + 1;
    preview.append(img, badge);
    const name = document.createElement('span');
    name.className = 'image-name';
    name.textContent = item.file.name;
    name.title = item.file.name;
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const definitions = [
      ['→', 'نقل إلى الصفحة السابقة', () => move(index, -1), index === 0],
      ['←', 'نقل إلى الصفحة التالية', () => move(index, 1), index === images.length - 1],
      ['↻', 'تدوير الصورة', () => { item.rotation = (item.rotation + 90) % 360; refresh(); }, false],
      ['×', 'حذف الصورة', () => { URL.revokeObjectURL(item.url); images.splice(index, 1); refresh(); }, false]
    ];
    for (const [symbol, label, action, disabled] of definitions) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = symbol;
      button.title = label; button.setAttribute('aria-label', `${label}: ${item.file.name}`);
      button.disabled = disabled || loading || converting;
      button.addEventListener('click', action); actions.append(button);
    }
    card.append(preview, name, actions); $('image-grid').append(card);
  });
}
function move(index, direction) {
  [images[index], images[index + direction]] = [images[index + direction], images[index]];
  refresh();
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
    image.src = url;
  });
}
async function addFiles(files) {
  if (loading || converting) return;
  loading = true; refresh();
  const errors = [];
  for (const file of files) {
    if (images.length >= maxImages) { errors.push('الحد الأقصى هو 30 صورة في الملف الواحد.'); break; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      errors.push(`${file.name}: الصيغة غير مدعومة. اختر JPG أو PNG أو WebP.`); continue;
    }
    if (file.size > 20 * 1024 * 1024) { errors.push(`${file.name}: حجم الصورة يتجاوز 20 MB.`); continue; }
    const url = URL.createObjectURL(file);
    try {
      const decoded = await loadImage(url);
      if (!decoded.naturalWidth || decoded.naturalWidth * decoded.naturalHeight > 40_000_000) {
        throw new Error('الصورة كبيرة جدًا. الحد الأقصى 40 مليون بكسل.');
      }
      images.push({ file, url, rotation: 0 });
    } catch (error) { URL.revokeObjectURL(url); errors.push(`${file.name}: ${error.message}`); }
  }
  loading = false; $('file-input').value = ''; refresh();
  status(errors.join('\n'), errors.length > 0);
}
$('choose-files').onclick = $('add-more').onclick = () => $('file-input').click();
$('file-input').onchange = event => addFiles(Array.from(event.target.files));
$('clear-all').onclick = () => {
  images.forEach(item => URL.revokeObjectURL(item.url)); images.length = 0; refresh(); status('');
};
for (const type of ['dragenter', 'dragover']) {
  document.addEventListener(type, event => { event.preventDefault(); if (!loading && !converting) $('drop-zone').classList.add('dragging'); });
}
document.addEventListener('dragleave', event => { if (!event.relatedTarget) $('drop-zone').classList.remove('dragging'); });
document.addEventListener('drop', event => {
  event.preventDefault(); $('drop-zone').classList.remove('dragging');
  if (event.dataTransfer.files.length) addFiles(Array.from(event.dataTransfer.files));
});
$('quality').oninput = () => { $('quality-value').textContent = `${$('quality').value}%`; };
$('page-size').onchange = () => { $('orientation-field').disabled = $('page-size').value === 'image'; };
$('convert').onclick = async () => {
  if (!images.length || loading || converting) return;
  if (!window.jspdf) { status('تعذر تحميل مكتبة PDF. تأكد من وجود ملف المكتبة داخل مجلد vendor.', true); return; }
  converting = true; refresh();
  const settings = {
    size: $('page-size').value,
    orientation: document.querySelector('input[name="orientation"]:checked').value,
    margin: Number($('margin').value), quality: Number($('quality').value) / 100,
    filename: PdfTools.safeFilename($('filename').value)
  };
  try {
    let pdf;
    for (let i = 0; i < images.length; i++) {
      status(`جارٍ تجهيز الصفحة ${i + 1} من ${images.length}…`);
      $('convert').textContent = `جارٍ التحويل… ${Math.round(i / images.length * 100)}%`;
      await new Promise(resolve => setTimeout(resolve, 25));
      const item = images[i];
      const image = await loadImage(item.url);
      const rotated = item.rotation % 180 !== 0;
      const originalWidth = rotated ? image.naturalHeight : image.naturalWidth;
      const originalHeight = rotated ? image.naturalWidth : image.naturalHeight;
      // Bound canvas allocation and PDF size while retaining print-quality resolution.
      const scale = Math.min(1, 3200 / Math.max(originalWidth, originalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(originalWidth * scale));
      canvas.height = Math.max(1, Math.round(originalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('تعذر تجهيز الصور في هذا المتصفح.');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(item.rotation * Math.PI / 180);
      ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
      const box = PdfTools.layout(originalWidth, originalHeight, settings.size, settings.orientation, settings.margin);
      const orientation = box.pageWidth > box.pageHeight ? 'landscape' : 'portrait';
      if (!pdf) pdf = new jspdf.jsPDF({ orientation, unit: 'mm', format: [box.pageWidth, box.pageHeight], compress: true });
      else pdf.addPage([box.pageWidth, box.pageHeight], orientation);
      pdf.addImage(canvas.toDataURL('image/jpeg', settings.quality), 'JPEG', box.x, box.y, box.width, box.height);
      canvas.width = 0; canvas.height = 0;
    }
    await pdf.save(settings.filename, { returnPromise: true });
    status(`ملفك جاهز ✓ تم طلب تنزيل ${settings.filename} — ${images.length} صفحة.`);
  } catch (error) {
    console.error(error); status('تعذر إنشاء الملف. جرّب تقليل عدد الصور أو حجمها ثم أعد المحاولة.', true);
  } finally {
    converting = false; $('convert').textContent = 'إنشاء ملف PDF ↓'; refresh();
  }
};
refresh();
