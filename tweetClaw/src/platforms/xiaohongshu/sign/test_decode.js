const B64_CHARS = 'ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5';

function xhsB64Decode(str) {
  const charToIdx = {};
  for (let i = 0; i < B64_CHARS.length; i++) {
    charToIdx[B64_CHARS[i]] = i;
  }

  const cleaned = str.replace(/=+$/, '');
  const len = cleaned.length;
  const out = [];
  
  let buffer = 0;
  let bitsCollected = 0;
  
  for (let i = 0; i < len; i++) {
    const char = cleaned[i];
    const val = charToIdx[char];
    if (val === undefined) {
      throw new Error('Invalid char: ' + char);
    }
    
    buffer = (buffer << 6) | val;
    bitsCollected += 6;
    
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      out.push((buffer >> bitsCollected) & 0xff);
    }
  }
  return new TextDecoder().decode(new Uint8Array(out));
}

// Actual native header from successful request
const nativeXSCommon = "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";

console.log('Decoded Native Object:');
console.log(xhsB64Decode(nativeXSCommon));
