const SPREADSHEET_ID = '1-uyaYvEDLgl0yNn_cpoS1WxPhZCEvv9FlQIrkweeeTo';
const DATA_GID = 1374913182;
const PHOTO_FOLDER_NAME = 'Partol_Photos';

const PATROL_HEADERS = [
  'เสาไฟต้นที่', 'ประเภทงาน', 'ระดับแรงดัน', 'อุปกรณ์หลัก', 'อุปกรณ์', 'รหัส',
  'สิ่งผิดปกติที่ตรวจพบ', 'คำอธิบายสภาพปานกลาง', 'คำอธิบายสภาพแย่', 'ความเร่งด่วน',
  'สภาพ_ระยะเวลาที่แก้ไข', 'พิกัด', 'ภาพถ่าย', 'ImageURL', 'Link_ภาพ', 'แปลง_URLภาพ',
  'RecordId', 'CreatedAt',
];

const THERMAL_HEADERS = [
  'เสาไฟต้นที่', 'ประเภทงาน', 'ระดับแรงดัน', 'อุปกรณ์หลัก', 'อุปกรณ์', 'รหัส',
  'สิ่งผิดปกติที่ตรวจพบ', 'คำอธิบายสภาพปานกลาง', 'คำอธิบายสภาพแย่', 'คำอธิบายสภาพแย่มาก',
  'ΔT', 'ความเร่งด่วน', 'สภาพ_ระยะเวลาที่แก้ไข', 'พิกัด', 'ภาพถ่าย', 'ImageURL',
  'Link_ภาพ', 'แปลง_URLภาพ', 'RecordId', 'CreatedAt',
];

const PD_HEADERS = [
  'เสาไฟต้นที่', 'ระดับแรงดัน', 'อุปกรณ์', 'สภาพ', 'แนวทางแก้ไข', 'ลักษณะ PD',
  'พิกัด', 'ภาพถ่าย', 'ImageURL', 'Link_ภาพ', 'แปลง_URLภาพ', 'RecordId', 'CreatedAt',
];

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheetByGid(ss, gid) {
  const sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === Number(gid)) return sheets[i];
  }
  return null;
}

function ensureSheet(ss, name, headers, gid) {
  var sheet = gid ? getSheetByGid(ss, gid) : ss.getSheetByName(name);
  if (!sheet) sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (!existing[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  for (var i = 0; i < headers.length; i++) {
    if (!existing[i]) sheet.getRange(1, i + 1).setValue(headers[i]);
  }
  return sheet;
}

function headerMap(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const names = sheet.getRange(1, 1, 1, width).getValues()[0];
  const map = {};
  for (var i = 0; i < names.length; i++) {
    if (names[i]) map[String(names[i])] = i;
  }
  return map;
}

function getPhotoFolder() {
  const ss = getSpreadsheet();
  const file = DriveApp.getFileById(ss.getId());
  const parents = file.getParents();
  const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  const found = parent.getFoldersByName(PHOTO_FOLDER_NAME);
  if (found.hasNext()) return found.next();
  return parent.createFolder(PHOTO_FOLDER_NAME);
}

function savePhoto(photoData, photoName, existingUrl) {
  const isData = photoData && String(photoData).indexOf('data:image') === 0;
  if (isData) {
    const match = String(photoData).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return existingUrl ? reusePhoto(existingUrl, photoData) : null;
    const blob = Utilities.newBlob(
      Utilities.base64Decode(match[2]),
      match[1],
      photoName || ('partol-' + new Date().getTime() + '.jpg'),
    );
    const file = getPhotoFolder().createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) {}
    const id = file.getId();
    return {
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + id,
      viewUrl: 'https://drive.google.com/file/d/' + id + '/view?usp=sharing',
      thumbUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200',
    };
  }
  if (existingUrl) return reusePhoto(existingUrl, photoData);
  if (photoData && String(photoData).indexOf('http') === 0) {
    return reusePhoto(photoData, photoData);
  }
  return null;
}

function reusePhoto(url, thumb) {
  return {
    downloadUrl: url,
    viewUrl: url,
    thumbUrl: thumb && String(thumb).indexOf('http') === 0 ? thumb : url,
  };
}

function photoFormula(photo) {
  if (!photo) return '';
  return '=HYPERLINK("' + photo.downloadUrl + '", IMAGE("' + photo.thumbUrl + '"))';
}

function findRowById(sheet, id) {
  const map = headerMap(sheet);
  const idCol = map.RecordId;
  if (idCol === undefined) return -1;
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const values = sheet.getRange(2, idCol + 1, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function writeCells(sheet, row, valuesByHeader) {
  const map = headerMap(sheet);
  const width = Math.max(sheet.getLastColumn(), Object.keys(map).length);
  const rowValues = sheet.getRange(row, 1, 1, width).getValues()[0];
  const formulas = {};
  Object.keys(valuesByHeader).forEach(function (key) {
    const col = map[key];
    if (col === undefined) return;
    const value = valuesByHeader[key];
    if (value && String(value).indexOf('=') === 0) {
      formulas[col] = value;
    } else {
      rowValues[col] = value;
    }
  });
  sheet.getRange(row, 1, 1, width).setValues([rowValues]);
  Object.keys(formulas).forEach(function (col) {
    sheet.getRange(row, Number(col) + 1).setFormula(formulas[col]);
  });
  if (valuesByHeader['ภาพถ่าย']) sheet.setRowHeight(row, 96);
}

function parseBody(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {}
  }
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  return e.parameter || {};
}

function upsertPatrol(record) {
  const sheet = ensureSheet(getSpreadsheet(), 'Data', PATROL_HEADERS, DATA_GID);
  const photo = savePhoto(record.photoData, record.photoName, record.photoUrl);
  const row = Math.max(findRowById(sheet, record.id), 0) || sheet.getLastRow() + 1;
  const target = row < 2 ? sheet.getLastRow() + 1 : row;
  writeCells(sheet, target, {
    'เสาไฟต้นที่': record.pole || '',
    'ประเภทงาน': record.jobType || 'งาน Patrol',
    'ระดับแรงดัน': record.voltage || '',
    'อุปกรณ์หลัก': record.mainEquipment || '',
    'อุปกรณ์': record.equipment || '',
    'รหัส': record.code || '',
    'สิ่งผิดปกติที่ตรวจพบ': record.defect || '',
    'คำอธิบายสภาพปานกลาง': record.fairDesc || '',
    'คำอธิบายสภาพแย่': record.poorDesc || '',
    'ความเร่งด่วน': record.condition || '',
    'สภาพ_ระยะเวลาที่แก้ไข': record.action || '',
    'พิกัด': record.gps || '',
    'ภาพถ่าย': photo ? photoFormula(photo) : '',
    'ImageURL': photo ? photo.downloadUrl : '',
    'Link_ภาพ': photo ? photo.viewUrl : '',
    'แปลง_URLภาพ': photo ? photo.downloadUrl : '',
    'RecordId': record.id,
    'CreatedAt': record.createdAt || new Date().toISOString(),
  });
  return withPhotoFields(record, photo);
}

function upsertThermal(record) {
  const sheet = ensureSheet(getSpreadsheet(), 'ThermalData', THERMAL_HEADERS);
  const photo = savePhoto(record.photoData, record.photoName, record.photoUrl);
  const found = findRowById(sheet, record.id);
  const target = found > 0 ? found : sheet.getLastRow() + 1;
  writeCells(sheet, target, {
    'เสาไฟต้นที่': record.pole || '',
    'ประเภทงาน': record.jobType || 'งาน Thermal',
    'ระดับแรงดัน': record.voltage || '',
    'อุปกรณ์หลัก': record.mainEquipment || '',
    'อุปกรณ์': record.equipment || '',
    'รหัส': record.code || '',
    'สิ่งผิดปกติที่ตรวจพบ': record.defect || '',
    'คำอธิบายสภาพปานกลาง': record.fairDesc || '',
    'คำอธิบายสภาพแย่': record.poorDesc || '',
    'คำอธิบายสภาพแย่มาก': record.veryPoorDesc || '',
    'ΔT': record.deltaT === '' || record.deltaT == null ? '' : record.deltaT,
    'ความเร่งด่วน': record.condition || '',
    'สภาพ_ระยะเวลาที่แก้ไข': record.action || '',
    'พิกัด': record.gps || '',
    'ภาพถ่าย': photo ? photoFormula(photo) : '',
    'ImageURL': photo ? photo.downloadUrl : '',
    'Link_ภาพ': photo ? photo.viewUrl : '',
    'แปลง_URLภาพ': photo ? photo.downloadUrl : '',
    'RecordId': record.id,
    'CreatedAt': record.createdAt || new Date().toISOString(),
  });
  return withPhotoFields(record, photo);
}

function upsertPd(record) {
  const sheet = ensureSheet(getSpreadsheet(), 'PDData', PD_HEADERS);
  const photo = savePhoto(record.photoData, record.photoName, record.photoUrl);
  const found = findRowById(sheet, record.id);
  const target = found > 0 ? found : sheet.getLastRow() + 1;
  writeCells(sheet, target, {
    'เสาไฟต้นที่': record.pole || '',
    'ระดับแรงดัน': record.voltage || '',
    'อุปกรณ์': record.equipment || '',
    'สภาพ': record.condition || '',
    'แนวทางแก้ไข': record.action || '',
    'ลักษณะ PD': record.pdType || '',
    'พิกัด': record.gps || '',
    'ภาพถ่าย': photo ? photoFormula(photo) : '',
    'ImageURL': photo ? photo.downloadUrl : '',
    'Link_ภาพ': photo ? photo.viewUrl : '',
    'แปลง_URLภาพ': photo ? photo.downloadUrl : '',
    'RecordId': record.id,
    'CreatedAt': record.createdAt || new Date().toISOString(),
  });
  return withPhotoFields(record, photo);
}

function withPhotoFields(record, photo) {
  if (!photo) return record;
  record.photoUrl = photo.downloadUrl;
  record.photoData = photo.thumbUrl;
  record.photoName = record.photoName || 'ดาวน์โหลดภาพ';
  return record;
}

function cell(map, row, name) {
  const idx = map[name];
  if (idx === undefined) return '';
  const value = row[idx];
  return value == null ? '' : String(value);
}

function readRows(sheet, builder) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const map = headerMap(sheet);
  const width = Math.max(sheet.getLastColumn(), 1);
  const rows = sheet.getRange(2, 1, last - 1, width).getValues();
  const formulas = sheet.getRange(2, 1, last - 1, width).getFormulas();
  const out = [];
  for (var i = 0; i < rows.length; i++) {
    const rec = builder(map, rows[i], formulas[i], i + 2);
    if (rec) out.push(rec);
  }
  return out;
}

function photoFromRow(map, row, formulas) {
  const download = cell(map, row, 'ImageURL') || cell(map, row, 'แปลง_URLภาพ');
  const view = cell(map, row, 'Link_ภาพ');
  const raw = cell(map, row, 'ภาพถ่าย');
  const formula = map['ภาพถ่าย'] !== undefined ? String(formulas[map['ภาพถ่าย']] || '') : '';
  const fromFormula = formula.match(/https:\/\/[^"]+/) ? formula.match(/https:\/\/[^"]+/)[0] : '';
  const photoUrl = download || fromFormula;
  const looksHttp = raw.indexOf('http') === 0;
  return {
    photoName: looksHttp ? 'ดาวน์โหลดภาพ' : raw,
    photoData: looksHttp ? raw : (view || photoUrl),
    photoUrl: photoUrl,
  };
}

function readPatrol() {
  const sheet = ensureSheet(getSpreadsheet(), 'Data', PATROL_HEADERS, DATA_GID);
  return readRows(sheet, function (map, row, formulas, rowNumber) {
    const pole = cell(map, row, 'เสาไฟต้นที่');
    const code = cell(map, row, 'รหัส');
    if (!pole && !code) return null;
    const photos = photoFromRow(map, row, formulas);
    return {
      id: cell(map, row, 'RecordId') || ('pt-sheet-' + rowNumber),
      pole: pole,
      jobType: cell(map, row, 'ประเภทงาน') || 'งาน Patrol',
      voltage: cell(map, row, 'ระดับแรงดัน'),
      mainEquipment: cell(map, row, 'อุปกรณ์หลัก'),
      equipment: cell(map, row, 'อุปกรณ์'),
      code: code,
      defect: cell(map, row, 'สิ่งผิดปกติที่ตรวจพบ'),
      fairDesc: cell(map, row, 'คำอธิบายสภาพปานกลาง'),
      poorDesc: cell(map, row, 'คำอธิบายสภาพแย่'),
      condition: cell(map, row, 'ความเร่งด่วน'),
      action: cell(map, row, 'สภาพ_ระยะเวลาที่แก้ไข'),
      resistanceOhm: '',
      gps: cell(map, row, 'พิกัด'),
      createdAt: cell(map, row, 'CreatedAt') || new Date().toISOString(),
      photoName: photos.photoName,
      photoData: photos.photoData,
      photoUrl: photos.photoUrl,
    };
  });
}

function readThermal() {
  const sheet = getSpreadsheet().getSheetByName('ThermalData');
  if (!sheet) return [];
  return readRows(sheet, function (map, row, formulas, rowNumber) {
    const pole = cell(map, row, 'เสาไฟต้นที่');
    if (!pole && !cell(map, row, 'รหัส')) return null;
    const photos = photoFromRow(map, row, formulas);
    const deltaRaw = cell(map, row, 'ΔT');
    return {
      id: cell(map, row, 'RecordId') || ('th-sheet-' + rowNumber),
      pole: pole,
      jobType: cell(map, row, 'ประเภทงาน') || 'งาน Thermal',
      voltage: cell(map, row, 'ระดับแรงดัน'),
      mainEquipment: cell(map, row, 'อุปกรณ์หลัก'),
      equipment: cell(map, row, 'อุปกรณ์'),
      code: cell(map, row, 'รหัส'),
      defect: cell(map, row, 'สิ่งผิดปกติที่ตรวจพบ'),
      fairDesc: cell(map, row, 'คำอธิบายสภาพปานกลาง'),
      poorDesc: cell(map, row, 'คำอธิบายสภาพแย่'),
      veryPoorDesc: cell(map, row, 'คำอธิบายสภาพแย่มาก'),
      deltaT: deltaRaw === '' ? '' : Number(deltaRaw),
      condition: cell(map, row, 'ความเร่งด่วน'),
      action: cell(map, row, 'สภาพ_ระยะเวลาที่แก้ไข'),
      gps: cell(map, row, 'พิกัด'),
      createdAt: cell(map, row, 'CreatedAt') || new Date().toISOString(),
      photoName: photos.photoName,
      photoData: photos.photoData,
      photoUrl: photos.photoUrl,
    };
  });
}

function readPd() {
  const sheet = getSpreadsheet().getSheetByName('PDData');
  if (!sheet) return [];
  return readRows(sheet, function (map, row, formulas, rowNumber) {
    const pole = cell(map, row, 'เสาไฟต้นที่');
    if (!pole && !cell(map, row, 'อุปกรณ์')) return null;
    const photos = photoFromRow(map, row, formulas);
    return {
      id: cell(map, row, 'RecordId') || ('pd-sheet-' + rowNumber),
      pole: pole,
      voltage: cell(map, row, 'ระดับแรงดัน'),
      equipment: cell(map, row, 'อุปกรณ์'),
      condition: cell(map, row, 'สภาพ'),
      action: cell(map, row, 'แนวทางแก้ไข'),
      pdType: cell(map, row, 'ลักษณะ PD'),
      gps: cell(map, row, 'พิกัด'),
      createdAt: cell(map, row, 'CreatedAt') || new Date().toISOString(),
      photoName: photos.photoName,
      photoData: photos.photoData,
      photoUrl: photos.photoUrl,
    };
  });
}

function deleteById(tab, id) {
  const ss = getSpreadsheet();
  var sheet = null;
  if (tab === 'thermal') sheet = ss.getSheetByName('ThermalData');
  else if (tab === 'pd') sheet = ss.getSheetByName('PDData');
  else sheet = ensureSheet(ss, 'Data', PATROL_HEADERS, DATA_GID);
  if (!sheet) return false;
  const row = findRowById(sheet, id);
  if (row < 2) return false;
  sheet.deleteRow(row);
  return true;
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'list';
  if (action === 'list') {
    return jsonOut({
      ok: true,
      patrol: readPatrol(),
      thermal: readThermal(),
      pd: readPd(),
    });
  }
  return jsonOut({ ok: true, service: 'partol' });
}

function doPost(e) {
  const body = parseBody(e);
  const action = body.action || 'upsert';
  try {
    if (action === 'delete') {
      return jsonOut({ ok: deleteById(body.tab || 'patrol', body.id) });
    }
    const record = body.record || body;
    const tab = body.tab || 'patrol';
    var saved = record;
    if (tab === 'thermal') saved = upsertThermal(record);
    else if (tab === 'pd') saved = upsertPd(record);
    else saved = upsertPatrol(record);
    return jsonOut({ ok: true, record: saved });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}
