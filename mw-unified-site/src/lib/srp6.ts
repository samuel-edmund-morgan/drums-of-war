/**
 * CMaNGOS SRP6 password utilities.
 * Ported from /opt/cmangos-transfer/srp6_set_password.py
 *
 * Key facts (from C++ source):
 *   N = "894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7"
 *   g = 7
 *   Username and password are UPPERCASED.
 *   SHA1(USER:PASS) -> identity hash
 *   salt (s) = random 32 bytes, stored as uppercase BE hex (64 chars)
 *   verifier (v) = g^x mod N where x = SHA1(salt_LE || SHA1_identity_BE)
 *   v and s stored as BN_bn2hex -> uppercase BE hex, no leading zeros
 */

import crypto from "crypto";

const N = BigInt(
  "0x894B645E89E1535BBDAD5B8B290650530801B18EBFBF5E8FAB3C82872A3E9BB7"
);
const g = BigInt(7);

/** Match OpenSSL BN_num_bytes: ceil(bit_length / 8), 0 for 0 */
function bnNumBytes(n: bigint): number {
  if (n === 0n) return 0;
  let bits = 0;
  let v = n;
  while (v > 0n) {
    bits++;
    v >>= 1n;
  }
  return Math.ceil(bits / 8);
}

/**
 * Match BigNumber::AsByteArray(minSize=0, reverse=true).
 * BN_bn2bin outputs BE bytes, then std::reverse gives LE bytes.
 */
function bnAsByteArrayLE(n: bigint, minSize = 0): Buffer {
  const numBytes = bnNumBytes(n);
  const length = Math.max(minSize, numBytes);
  if (length === 0) return Buffer.alloc(0);

  // BE representation padded to 'length' bytes
  const hex = n.toString(16).padStart(length * 2, "0");
  const be = Buffer.from(hex, "hex");

  // std::reverse -> LE
  const le = Buffer.from(be);
  le.reverse();
  return le;
}

/**
 * Match BigNumber::AsHexStr() = BN_bn2hex -> uppercase BE hex, no leading zeros.
 */
function bnAsHexStr(n: bigint): string {
  if (n === 0n) return "0";
  return n.toString(16).toUpperCase();
}

/**
 * Match AccountMgr::CalculateShaPassHash.
 * Returns hexEncodeByteArray(SHA1(name:password)) -> 40-char uppercase hex.
 */
function calculateShaPassHash(username: string, password: string): string {
  const sha = crypto.createHash("sha1");
  sha.update(`${username}:${password}`, "utf8");
  return sha.digest("hex").toUpperCase();
}

/**
 * Modular exponentiation: base^exp mod mod.
 * Uses BigInt built-in (Node 10.4+).
 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  // Node doesn't have a built-in modPow for BigInt, so we implement one.
  let result = 1n;
  base = base % mod;
  if (base === 0n) return 0n;
  let e = exp;
  let b = base;
  while (e > 0n) {
    if (e % 2n === 1n) {
      result = (result * b) % mod;
    }
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
}

/**
 * Match SRP6::CalculateVerifier(rI, salt).
 * Returns { salt, verifier } as BigInts.
 */
function calculateVerifier(
  shaPassHex: string,
  saltInt?: bigint
): { salt: bigint; verifier: bigint } {
  // Generate salt if not provided
  if (saltInt === undefined) {
    const saltBytes = crypto.randomBytes(32);
    saltInt = BigInt("0x" + saltBytes.toString("hex"));
    while (saltInt === 0n) {
      const newBytes = crypto.randomBytes(32);
      saltInt = BigInt("0x" + newBytes.toString("hex"));
    }
  }

  // I.SetHexStr(rI) - parse SHA1 hex as BigNumber
  const iInt = BigInt("0x" + shaPassHex);

  // vect_I = I.AsByteArray() - LE bytes, natural length
  const iLE = bnAsByteArrayLE(iInt);

  // mDigest[20] = {0}; memcpy(mDigest, vect_I.data(), vect_I.size())
  const mDigest = Buffer.alloc(20, 0);
  const copyLen = Math.min(iLE.length, 20);
  iLE.copy(mDigest, 0, 0, copyLen);

  // std::reverse(mDigest, mDigest + 20) - LE -> BE
  mDigest.reverse();
  // Now mDigest = original SHA1 bytes in standard (BE) order

  // salt LE bytes: s.AsByteArray() - natural length
  const saltLE = bnAsByteArrayLE(saltInt);

  // SHA1(salt_LE || mDigest_BE)
  const sha = crypto.createHash("sha1");
  sha.update(saltLE);
  sha.update(mDigest);
  const xDigest = sha.digest();

  // x.SetBinary(digest, 20) - reads LE bytes
  const xHex = Buffer.from(xDigest).reverse().toString("hex");
  const x = BigInt("0x" + (xHex || "0"));

  // v = g^x mod N
  const v = modPow(g, x, N);

  return { salt: saltInt, verifier: v };
}

/**
 * Generate a random salt as uppercase BE hex string (variable length, no leading zeros).
 */
export function generateSalt(): { saltInt: bigint; saltHex: string } {
  const saltBytes = crypto.randomBytes(32);
  let saltInt = BigInt("0x" + saltBytes.toString("hex"));
  while (saltInt === 0n) {
    const newBytes = crypto.randomBytes(32);
    saltInt = BigInt("0x" + newBytes.toString("hex"));
  }
  return { saltInt, saltHex: bnAsHexStr(saltInt) };
}

/**
 * Compute SRP6 salt and verifier for a given username and password.
 * Returns { saltHex, verifierHex } as uppercase BE hex strings.
 */
export function computeVerifier(
  username: string,
  password: string,
  saltInt?: bigint
): { saltHex: string; verifierHex: string; saltInt: bigint } {
  const user = username.toUpperCase();
  const pass = password.toUpperCase();
  const shaPassHex = calculateShaPassHash(user, pass);
  const { salt, verifier } = calculateVerifier(shaPassHex, saltInt);
  return {
    saltHex: bnAsHexStr(salt),
    verifierHex: bnAsHexStr(verifier),
    saltInt: salt,
  };
}

/**
 * Verify a password against stored SRP6 salt and verifier (both as uppercase BE hex).
 */
export function verifyPassword(
  username: string,
  password: string,
  storedSaltHex: string,
  storedVerifierHex: string
): boolean {
  const user = username.toUpperCase();
  const pass = password.toUpperCase();
  const shaPassHex = calculateShaPassHash(user, pass);
  const saltInt = BigInt("0x" + storedSaltHex);
  const { verifier } = calculateVerifier(shaPassHex, saltInt);
  const computedHex = bnAsHexStr(verifier);
  return computedHex === storedVerifierHex.toUpperCase();
}

/**
 * Compute raw salt and verifier as binary Buffers (32 bytes each, LE).
 * Used for AzerothCore which stores binary(32) columns.
 */
export function computeVerifierBinary(
  username: string,
  password: string
): { saltBuffer: Buffer; verifierBuffer: Buffer; saltHex: string; verifierHex: string } {
  const { saltHex, verifierHex, saltInt } = computeVerifier(username, password);
  // AzerothCore stores salt and verifier as reversed (LE) binary(32)
  const saltBuffer = Buffer.alloc(32, 0);
  const saltLE = bnAsByteArrayLE(saltInt, 32);
  saltLE.copy(saltBuffer);

  const verifierInt = BigInt("0x" + verifierHex);
  const verifierBuffer = Buffer.alloc(32, 0);
  const verifierLE = bnAsByteArrayLE(verifierInt, 32);
  verifierLE.copy(verifierBuffer);

  return { saltBuffer, verifierBuffer, saltHex, verifierHex };
}
