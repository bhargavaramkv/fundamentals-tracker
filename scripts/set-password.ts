/**
 * Creates lib/login-vault.json from a username and password. Only a salt and a
 * key-check ciphertext are written; the password itself is never stored.
 *
 * Usage:
 *   LOGIN_USERNAME=bhargav LOGIN_PASSWORD='…' npm run set-password
 *   npm run set-password -- --generate     # prints a new random password once
 */
import { randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createLoginVault } from "../lib/vault";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword(): string {
  // 4 groups of 5 from a 56-char alphabet ≈ 116 bits of entropy.
  const group = () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return [group(), group(), group(), group()].join("-");
}

async function main() {
  const username = process.env.LOGIN_USERNAME ?? "bhargav";
  const generate = process.argv.includes("--generate");
  const password = generate ? generatePassword() : process.env.LOGIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set LOGIN_PASSWORD (12+ chars) or pass --generate.");
  }
  const vault = await createLoginVault(username, password);
  const out = path.resolve(import.meta.dirname, "..", "lib", "login-vault.json");
  fs.writeFileSync(out, JSON.stringify(vault, null, 2) + "\n");
  process.stdout.write(`Wrote ${path.relative(process.cwd(), out)} for user "${vault.username}".\n`);
  if (generate) process.stdout.write(`Password (shown once, not stored anywhere): ${password}\n`);
}

void main();
