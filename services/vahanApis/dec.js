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

privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');


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

  const result = calculateHmacSHA256(decryptedBytes.toString(), decryptedData);


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
