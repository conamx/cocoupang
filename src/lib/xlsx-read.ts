/**
 * 브라우저에서 .xlsx 첫 번째 시트를 표(string[][])로 읽는다. 외부 라이브러리 없이
 * zip(중앙 디렉터리) + DecompressionStream('deflate-raw') + DOMParser 만 사용.
 * 정보글 엑셀 양식 업로드용이라 글자·숫자 칸만 읽는다(수식은 마지막 계산값).
 */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buf: ArrayBuffer): Promise<Map<string, () => Promise<string>>> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('엑셀(.xlsx) 파일이 아니에요');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = new Map<string, () => Promise<string>>();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    files.set(name, async () => {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const raw = u8.subarray(start, start + csize);
      const out = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
      if (!out) throw new Error('지원하지 않는 압축 방식');
      return dec.decode(out);
    });
  }
  return files;
}

const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');
const textOf = (el: Element) =>
  Array.from(el.getElementsByTagName('t'))
    .map((t) => t.textContent ?? '')
    .join('');

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readXlsxFirstSheet(file: File): Promise<string[][]> {
  const files = await unzip(await file.arrayBuffer());
  const get = async (name: string) => (files.has(name) ? await files.get(name)!() : null);

  // 첫 번째 시트 경로: workbook.xml 의 첫 sheet → rels 에서 실제 파일
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = await get('xl/workbook.xml');
  const rels = await get('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName('sheet')[0];
    const rid = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = Array.from(xml(rels).getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  }

  const ssXml = await get('xl/sharedStrings.xml');
  const shared = ssXml ? Array.from(xml(ssXml).getElementsByTagName('si')).map(textOf) : [];
  const sheet = await get(sheetPath);
  if (!sheet) throw new Error('엑셀 시트를 찾지 못했어요');

  const table: string[][] = [];
  for (const row of Array.from(xml(sheet).getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r') ?? table.length + 1) - 1;
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const t = c.getAttribute('t');
      const vEl = c.getElementsByTagName('v')[0];
      let val = '';
      if (t === 's') val = shared[Number(vEl?.textContent ?? -1)] ?? '';
      else if (t === 'inlineStr') val = textOf(c);
      else val = vEl?.textContent ?? '';
      const ref = c.getAttribute('r');
      cells[ref ? colIndex(ref) : cells.length] = val;
    }
    table[r] = Array.from(cells, (x) => x ?? '');
  }
  return Array.from(table, (x) => x ?? []);
}
