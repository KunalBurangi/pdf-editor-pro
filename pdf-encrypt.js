/**
 * pdf-encrypt.js - Client-Side PDF Password Encryption Engine
 * Standard-compliant RC4 128-bit encryption for PDF documents (PDF 1.7 / ISO 32000-1)
 * Works directly with PDFLib without external servers or network requests.
 * @license MIT
 */
(function (global) {
  if (typeof global.encryptPDF === 'function') return;

  function getPDFLib() {
    const P = global.PDFLib;
    if (!P) throw new Error('PDFLib is required for PDF encryption. Ensure pdf-lib.js is loaded.');
    return P;
  }

  // MD5 implementation
  function md5(data) {
    const t = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const n = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];
    const s = new Uint32Array([
      3614090360, 3905402710, 606105819, 3250441966, 4118548399, 1200080426, 2821735955, 4249261313,
      1770035416, 2336552879, 4294925233, 2304563134, 1804603682, 4254626195, 2792965006, 1236535329,
      4129170786, 3225465664, 643717713, 3921069994, 3593408605, 38016083, 3634488961, 3889429448,
      568446438, 3275163606, 4107603335, 1163531501, 2850285829, 4243563512, 1735328473, 2368359562,
      4294588738, 2272392833, 1839030562, 4259657740, 2763975236, 1272893353, 4139469664, 3200236656,
      681279174, 3936430074, 3572445317, 76029189, 3654602809, 3873151461, 530742520, 3299628645,
      4096336452, 1126891415, 2878612391, 4237533241, 1700485571, 2399980690, 4293915773, 2240044497,
      1873313359, 4264355552, 2734768916, 1309151649, 4149444226, 3174756917, 718787259, 3951481745
    ]);
    let c = 1732584193, i = 4023233417, r = 2562383102, x = 271733878;
    const f = t.length, d = f * 8, l = (f + 9 + 63) & -64, g = new Uint8Array(l);
    g.set(t);
    g[f] = 128;
    const U = new DataView(g.buffer);
    U.setUint32(l - 8, d, true);
    U.setUint32(l - 4, 0, true);
    for (let R = 0; R < l; R += 64) {
      const M = new Uint32Array(g.buffer, R, 16);
      let D = c, h = i, F = r, p = x;
      for (let a = 0; a < 64; a++) {
        let o, u;
        if (a < 16) { o = (h & F) | (~h & p); u = a; }
        else if (a < 32) { o = (p & h) | (~p & F); u = (5 * a + 1) % 16; }
        else if (a < 48) { o = h ^ F ^ p; u = (3 * a + 5) % 16; }
        else { o = F ^ (h | ~p); u = (7 * a) % 16; }
        o = (o + D + s[a] + M[u]) >>> 0;
        D = p; p = F; F = h;
        h = (h + ((o << n[a]) | (o >>> (32 - n[a])))) >>> 0;
      }
      c = (c + D) >>> 0;
      i = (i + h) >>> 0;
      r = (r + F) >>> 0;
      x = (x + p) >>> 0;
    }
    const m = new Uint8Array(16);
    const y = new DataView(m.buffer);
    y.setUint32(0, c, true);
    y.setUint32(4, i, true);
    y.setUint32(8, r, true);
    y.setUint32(12, x, true);
    return m;
  }

  // RC4 stream cipher implementation
  class RC4 {
    constructor(key) {
      this.s = new Uint8Array(256);
      this.i = 0;
      this.j = 0;
      for (let s = 0; s < 256; s++) this.s[s] = s;
      let n = 0;
      for (let s = 0; s < 256; s++) {
        n = (n + this.s[s] + key[s % key.length]) & 255;
        [this.s[s], this.s[n]] = [this.s[n], this.s[s]];
      }
    }
    process(data) {
      const n = new Uint8Array(data.length);
      for (let s = 0; s < data.length; s++) {
        this.i = (this.i + 1) & 255;
        this.j = (this.j + this.s[this.i]) & 255;
        [this.s[this.i], this.s[this.j]] = [this.s[this.j], this.s[this.i]];
        const c = (this.s[this.i] + this.s[this.j]) & 255;
        n[s] = data[s] ^ this.s[c];
      }
      return n;
    }
  }

  function bytesToHex(bytes) {
    return Array.from(bytes).map(t => t.toString(16).padStart(2, '0')).join('');
  }

  const kMap = {
    22: 23, 24: 728, 25: 711, 26: 710, 27: 729, 28: 733, 29: 731, 30: 730, 31: 732,
    127: -1, 128: 8226, 129: 8224, 130: 8225, 131: 8230, 132: 8212, 133: 8211, 134: 402,
    135: 8260, 136: 8249, 137: 8250, 138: 8722, 139: 8240, 140: 8222, 141: 8220, 142: 8221,
    143: 8216, 144: 8217, 145: 8218, 146: 8482, 147: 64257, 148: 64258, 149: 321, 150: 338,
    151: 352, 152: 376, 153: 381, 154: 305, 155: 322, 156: 339, 157: 353, 158: 382,
    159: -1, 160: 8364, 173: -1
  };
  const charMap = (() => {
    const e = new Map();
    for (let t = 0; t < 256; t++) {
      const n = t in kMap ? kMap[t] : t;
      if (n >= 0 && e.get(n) !== n) e.set(n, t);
    }
    return e;
  })();

  function encodePasswordLegacy(str) {
    const t = [];
    for (const n of str) {
      const s = charMap.get(n.codePointAt(0));
      t.push(s !== undefined ? s : n.charCodeAt(0) & 255);
    }
    return new Uint8Array(t);
  }

  const PADDING = new Uint8Array([
    40, 191, 78, 94, 78, 117, 138, 65, 100, 0, 78, 86, 255, 250, 1, 8,
    46, 46, 0, 182, 208, 104, 62, 128, 47, 12, 169, 254, 100, 83, 105, 122
  ]);

  function padPassword(pwd) {
    const t = encodePasswordLegacy(pwd || '');
    const n = new Uint8Array(32);
    if (t.length >= 32) {
      n.set(t.slice(0, 32));
    } else {
      n.set(t);
      n.set(PADDING.slice(0, 32 - t.length), t.length);
    }
    return n;
  }

  function computeOwnerKey(ownerPwd, userPwd) {
    const n = padPassword(ownerPwd || userPwd);
    let s = md5(n);
    for (let r = 0; r < 50; r++) s = md5(s);
    const c = padPassword(userPwd);
    let i = new Uint8Array(c);
    for (let r = 0; r < 20; r++) {
      const x = new Uint8Array(s.length);
      for (let d = 0; d < s.length; d++) x[d] = s[d] ^ r;
      i = new RC4(x.slice(0, 16)).process(i);
    }
    return i;
  }

  function computeEncryptionKey(userPwd, ownerKey, permissions, docId) {
    const c = padPassword(userPwd);
    const i = new Uint8Array(c.length + ownerKey.length + 4 + docId.length);
    let r = 0;
    i.set(c, r); r += c.length;
    i.set(ownerKey, r); r += ownerKey.length;
    i[r++] = permissions & 255;
    i[r++] = (permissions >> 8) & 255;
    i[r++] = (permissions >> 16) & 255;
    i[r++] = (permissions >> 24) & 255;
    i.set(docId, r);
    let x = md5(i);
    for (let f = 0; f < 50; f++) x = md5(x.slice(0, 16));
    return x.slice(0, 16);
  }

  function computeUserKey(encKey, docId) {
    const n = new Uint8Array(PADDING.length + docId.length);
    n.set(PADDING);
    n.set(docId, PADDING.length);
    const s = md5(n);
    let i = new RC4(encKey).process(s);
    for (let x = 1; x <= 19; x++) {
      const f = new Uint8Array(encKey.length);
      for (let l = 0; l < encKey.length; l++) f[l] = encKey[l] ^ x;
      i = new RC4(f).process(i);
    }
    const r = new Uint8Array(32);
    r.set(i);
    r.set(new Uint8Array(16), 16);
    return r;
  }

  function encryptBytes(data, objNum, genNum, encKey) {
    const c = new Uint8Array(encKey.length + 5);
    c.set(encKey);
    c[encKey.length] = objNum & 255;
    c[encKey.length + 1] = (objNum >> 8) & 255;
    c[encKey.length + 2] = (objNum >> 16) & 255;
    c[encKey.length + 3] = genNum & 255;
    c[encKey.length + 4] = (genNum >> 8) & 255;
    const i = md5(c);
    return new RC4(i.slice(0, Math.min(encKey.length + 5, 16))).process(data);
  }

  function escapeLiteralString(bytes) {
    const t = new Array(bytes.length);
    for (let n = 0; n < bytes.length; n++) {
      const s = bytes[n];
      if (s === 92) t[n] = '\\\\';
      else if (s === 40) t[n] = '\\(';
      else if (s === 41) t[n] = '\\)';
      else if (s === 13) t[n] = '\\r';
      else if (s === 10) t[n] = '\\n';
      else t[n] = String.fromCharCode(s);
    }
    return t.join('');
  }

  function isSignatureDict(PDFLib, dict) {
    const type = dict.get(PDFLib.PDFName.of('Type'));
    const typeStr = type && typeof type.asString === 'function' ? type.asString() : null;
    if (typeStr === '/Sig' || typeStr === '/DocTimeStamp') return true;
    if (typeStr !== null) return false;
    const byteRange = dict.get(PDFLib.PDFName.of('ByteRange'));
    return (byteRange instanceof PDFLib.PDFArray && byteRange.size() === 4 && dict.has(PDFLib.PDFName.of('Contents')));
  }

  function encryptPdfObject(PDFLib, obj, objNum, genNum, encKey, visited) {
    if (!obj || visited.has(obj)) return;
    if (obj instanceof PDFLib.PDFString) {
      visited.add(obj);
      const raw = obj.asBytes();
      const enc = encryptBytes(raw, objNum, genNum, encKey);
      obj.value = escapeLiteralString(enc);
    } else if (obj instanceof PDFLib.PDFHexString) {
      visited.add(obj);
      const raw = obj.asBytes();
      const enc = encryptBytes(raw, objNum, genNum, encKey);
      obj.value = bytesToHex(enc);
    } else if (obj instanceof PDFLib.PDFDict) {
      visited.add(obj);
      const isSig = isSignatureDict(PDFLib, obj);
      for (const [key, val] of obj.entries()) {
        const keyStr = key.asString();
        if (keyStr === '/Length' || keyStr === '/Filter' || keyStr === '/DecodeParms') continue;
        if (isSig && keyStr === '/Contents') continue;
        encryptPdfObject(PDFLib, val, objNum, genNum, encKey, visited);
      }
    } else if (obj instanceof PDFLib.PDFArray) {
      visited.add(obj);
      for (const item of obj.asArray()) {
        encryptPdfObject(PDFLib, item, objNum, genNum, encKey, visited);
      }
    }
  }

  /**
   * Encrypts a PDF Uint8Array or ArrayBuffer with standard RC4 128-bit password protection.
   * @param {Uint8Array|ArrayBuffer} pdfBytes - Source PDF data
   * @param {string} userPassword - Password required to open and read the PDF
   * @param {string|object} [ownerPasswordOrOptions] - Optional owner password or options
   * @returns {Promise<Uint8Array>} - Encrypted PDF bytes
   */
  async function encryptPDF(pdfBytes, userPassword, ownerPasswordOrOptions = null) {
    const PDFLib = getPDFLib();
    const { PDFDocument, PDFName, PDFArray, PDFHexString, PDFNumber, PDFRawStream, PDFDict } = PDFLib;

    const opts = ownerPasswordOrOptions && typeof ownerPasswordOrOptions === 'object' && !Array.isArray(ownerPasswordOrOptions)
      ? ownerPasswordOrOptions
      : { ownerPassword: ownerPasswordOrOptions };

    const ownerPwd = opts.ownerPassword != null ? opts.ownerPassword : userPassword;
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
    if (doc.isEncrypted) {
      throw new Error('This PDF is already password-protected.');
    }

    const ctx = doc.context;
    const trailer = ctx.trailerInfo;
    let docId = trailer.ID;
    let fileIdBytes;

    const firstId = docId instanceof PDFArray ? docId.get(0) : (Array.isArray(docId) && docId.length > 0 ? docId[0] : undefined);
    if (firstId && typeof firstId.asBytes === 'function' && firstId.asBytes().length > 0) {
      fileIdBytes = firstId.asBytes();
    } else {
      fileIdBytes = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(fileIdBytes);
      } else {
        for (let i = 0; i < 16; i++) fileIdBytes[i] = Math.floor(Math.random() * 256);
      }
      const hexId = PDFHexString.of(bytesToHex(fileIdBytes));
      trailer.ID = [hexId, hexId];
    }

    // Permissions: Allow printing, copying, annotation, form filling
    const permissions = -3904 | (opts.allowPrinting !== false ? 4 | 2048 : 0) | (opts.allowCopying !== false ? 16 : 0) | (opts.allowModifying !== false ? 8 : 0);

    const ownerKey = computeOwnerKey(ownerPwd, userPassword);
    const encKey = computeEncryptionKey(userPassword, ownerKey, permissions, fileIdBytes);
    const userKey = computeUserKey(encKey, fileIdBytes);

    const indirectObjects = ctx.enumerateIndirectObjects();
    const visited = new WeakSet();

    for (const [ref, obj] of indirectObjects) {
      const objNum = ref.objectNumber;
      const genNum = ref.generationNumber || 0;

      if (obj instanceof PDFDict) {
        const filter = obj.get(PDFName.of('Filter'));
        if (filter && filter.asString() === '/Standard') continue;
      }
      if (obj instanceof PDFRawStream && obj.dict) {
        const type = obj.dict.get(PDFName.of('Type'));
        if (type) {
          const typeStr = type.toString();
          if (typeStr === '/XRef' || typeStr === '/Sig') continue;
        }
      }
      if (obj instanceof PDFRawStream) {
        const encryptedStream = encryptBytes(obj.contents, objNum, genNum, encKey);
        obj.contents = encryptedStream;
        if (obj.dict) encryptPdfObject(PDFLib, obj.dict, objNum, genNum, encKey, visited);
      } else {
        encryptPdfObject(PDFLib, obj, objNum, genNum, encKey, visited);
      }
    }

    const encryptDict = ctx.obj({
      Filter: PDFName.of('Standard'),
      V: PDFNumber.of(2),
      R: PDFNumber.of(3),
      Length: PDFNumber.of(128),
      P: PDFNumber.of(permissions),
      O: PDFHexString.of(bytesToHex(ownerKey)),
      U: PDFHexString.of(bytesToHex(userKey))
    });

    trailer.Encrypt = ctx.register(encryptDict);
    return await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  }

  global.encryptPDF = encryptPDF;
})(typeof window !== 'undefined' ? window : globalThis);
