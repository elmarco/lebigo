export type TarEntry = {
  name: string;
  data: Uint8Array;
};

const BLOCK = 512;

function encodeString(buf: Uint8Array, offset: number, str: string, len: number) {
  for (let i = 0; i < len && i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

function encodeOctal(buf: Uint8Array, offset: number, value: number, len: number) {
  const str = value.toString(8).padStart(len - 1, "0");
  encodeString(buf, offset, str, len - 1);
  buf[offset + len - 1] = 0;
}

function computeChecksum(header: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) {
    sum += i >= 148 && i < 156 ? 32 : header[i];
  }
  return sum;
}

function createHeader(name: string, size: number): Uint8Array {
  const header = new Uint8Array(BLOCK);

  encodeString(header, 0, name, 100);
  encodeOctal(header, 100, 0o644, 8);
  encodeOctal(header, 108, 0, 8);
  encodeOctal(header, 116, 0, 8);
  encodeOctal(header, 124, size, 12);
  encodeOctal(header, 136, Math.floor(Date.now() / 1000), 12);
  header[156] = 48; // '0' = regular file
  encodeString(header, 257, "ustar\0", 6);
  encodeString(header, 263, "00", 2);

  const checksum = computeChecksum(header);
  const csStr = checksum.toString(8).padStart(6, "0");
  encodeString(header, 148, csStr, 6);
  header[154] = 0;
  header[155] = 32;

  return header;
}

export function tarCreate(entries: TarEntry[]): Uint8Array {
  let totalSize = 0;
  for (const entry of entries) {
    totalSize += BLOCK;
    totalSize += Math.ceil(entry.data.length / BLOCK) * BLOCK;
  }
  totalSize += BLOCK * 2;

  const out = new Uint8Array(totalSize);
  let offset = 0;

  for (const entry of entries) {
    const header = createHeader(entry.name, entry.data.length);
    out.set(header, offset);
    offset += BLOCK;

    out.set(entry.data, offset);
    offset += Math.ceil(entry.data.length / BLOCK) * BLOCK;
  }

  return out;
}
