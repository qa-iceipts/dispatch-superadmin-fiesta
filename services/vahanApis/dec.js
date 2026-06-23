const crypto = require("crypto");
const forge = require("node-forge"); // Import the Forge library

// Get private key from environment variable based on environment
let privateKeyPem;
if (process.env.VAHANENV === "PROD") {
  privateKeyPem = process.env.VAHAN_PROD_PRIVATE_KEY;
} else {
  privateKeyPem = process.env.VAHAN_UAT_PRIVATE_KEY;
}

// Check if key is available
if (!privateKeyPem) {
  console.error(`[VAHAN] Private key not found. Environment: ${process.env.VAHANENV || 'UAT'}`);
  throw new Error(`VAHAN private key not set in environment variables`);
}

// Replace escaped newlines with actual newlines
privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');



// Your private key
// const privateKeyPem = `-----BEGIN PRIVATE KEY-----
// MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCihr6dGR+xd9AO
// PzpMGjZKQKsIvDP65hIT5/WpqlM6uJ0oNSov8LTv+CSvMb2vtb+F/zgjF6+gPU+7
// VVJp5NFvrQ8tlwyeIAiq0WpVqVnPQeoAr+pEcwZRorQA33uA3cJ61swrEaKneITD
// cSHCvSuw+08n/aK8NZdkA399o19xuoRRRRB4OA2ait77gl8qKAuiNEfc6Xz0IYwt
// sPsbvyIkC6OZ7NKXfLziqRnVOkp9aNMZl6cYNYbejBATR5AcDXjNZVlBwWVyJAEH
// AyhSBAckLMghnDUoY6E5vbGT6DtFnD3rVxKqrR5HKEUgzAT9TrriKU3avxIW8idE
// BZ9RB7JzAgMBAAECggEAPeYTssFe0LhRBRwPl+xjwOPgP/Nt2KDHQc2WQogcKsEl
// Gasl5hxGzR402oSXOdR+nQoW10auHNk9BJv6R1peaan/nd1pcM/CfUxEs1tMWSNB
// fAGDt44XWgAdjjePUgUjjKVCHSUaTa4Y4la0BPcHLOCJxTFUSVofzneGltMiBq3m
// ujeuUgQft2rWZ319JZifAl6Wh6FIzz/lZqj9TYri6Z+uqYliCoT6kC7DHWuvxXEU
// EwQfEbgiXDXP9aWoBBzET8FshtWTf/Q/AdxW2ZK9LsDec5ArnDyQ4836p//JWTK1
// 5QwbdnbhB+dvys4ChX1zRUG/3wKzSmppzwmToT5gAQKBgQC6oK1fpn6EjlOJWuqD
// /4RELlCA9qOkQ0B/DZe2m8tKguqU4ing2B61594YgHYH8UAgis6dEohlmNKXxQFV
// xXPfEmzNmiIosKv5mWxvuCKcHEzBX3puwX+ndvqzIV/bblRuclmIqV/FgKohfoBs
// uiOAJB/x9WMAVi+Vbt07tUusIQKBgQDe8JveqyK1EqwIo6vUPhva3kC7WTqE1Dxo
// oJuGPOon1E1xvcAzLzaXLEGeFpWE/1mqo4rSqOJr5Pv4hDTbYwXSYaPoH7k5QLum
// YX4uM7Xckw3W9YKan5YObxS7mKlYXTqHBhkaY5NXeZsbPeMWv+MZPNYbO1KxIEqR
// PlATFkxsEwKBgEWVMO8v0Y40zrqwti2e8D7HkeZzjxHorTxx4fYI4mQWqcX3CSw3
// CEREfk9eXiOZ9JHtjxmLVmWi9Cn4HwZOx2QNp5mE9WV8cbJvXLnOysCv4IJcyfZP
// mPvkZZayQ945patEYVON6xJlZYl1dAaV5DSbw3lgR5hRig5KNpxTfTJhAoGAc+oQ
// cQ70BcfGkNtgrQL6AquKZp63MXcUTaYsFvi3Gqxk892gADztGl7VYzgE19jYq0NL
// G8rZpxWw+P7saKEs1r0Tts4/xQfmSVTpgWY7iYsgKAMQvAp7v9d7pSpz6lDW7Ht8
// M99QLaw5vElKOHrevjGGdTQ8A4JxouEOS05Nv+cCgYAJ5/vUKZ0P+pvoBdyA3y/H
// gui4sxvvVqBjA0ZNV2PvzT9vCRuRERxhmmCcTc5q86sr4X+m8bQVdNmfE2Dy6kPe
// GJoaL0doNud9ocTaCsBbHhwyy11kZNMcV+Wdm+5vN99AOSZh2pIyKVgcIakckk65
// beumbfFDfYUCVeLGRLrhRA==
// -----END PRIVATE KEY-----`;

const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

function calculateHmacSHA256(plainSymmetricKeyReceived, encryptedData) {
  const hasher = crypto.createHmac(
    "sha256",
    Buffer.from(plainSymmetricKeyReceived)
  );
  const hash = hasher.update(encryptedData).digest("base64");
  return hash;
}

function getAESKeyFromPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 65536, 32, "sha256");
}

function decrypt(data, plainSymmetricKey) {
  const decodedData = Buffer.from(data, "base64");
  const iv = decodedData.slice(0, 12); // IV length is 12 bytes
  const salt = decodedData.slice(12, 28); // Salt length is 16 bytes
  const cipherText = decodedData.slice(28); // remaining data

  const aesKeyFromPassword = getAESKeyFromPassword(
    Buffer.from(plainSymmetricKey),
    salt
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    aesKeyFromPassword,
    iv
  );

  decipher.setAuthTag(cipherText.slice(cipherText.length - 16)); // Auth tag length is 16 bytes

  const encryptedData = Buffer.concat([
    cipherText.slice(0, cipherText.length - 16),
  ]);

  const decryptedData = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decryptedData.toString("utf8");
}

let encDataFuciton = async (encryptedKEY, EncData, hash) => {
  const decryptedBytes = privateKey.decrypt(
    Buffer.from(encryptedKEY, "base64"),
    "RSA-OAEP",
    {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha256.create(),
      },
    }
  );

  const decryptedData = decrypt(EncData, decryptedBytes.toString());
  console.log("decodedData : " + decryptedData);

  const result = calculateHmacSHA256(decryptedBytes.toString(), decryptedData);

  console.log("decodedKey : " + decryptedBytes.toString());
  console.log("hash : " + result);

  if (result == hash) {
    console.log("hash matched");
    return decryptedData; // Return decrypted data on successful verification
  } else {
    console.log("hash not matched");
    throw new Error("Hash validation failed");
  }
};

module.exports = {
  encDataFuciton,
};
