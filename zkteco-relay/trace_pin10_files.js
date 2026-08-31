const fs = require("fs");
const path = require("path");

const PIN = "10";

const knownPaths = [
  "/upload/pers/user/avatar/2026-08-29/10.jpg",
  "upload/pers/user/cropface/10/10.jpg",
];

const roots = [
  "C:\\Program Files\\ZKTeco",
  "C:\\Program Files (x86)\\ZKTeco",
  "C:\\ZKTeco",
  "C:\\ZKBio",
  "C:\\ZKBio CVAccess",
  "C:\\CVAccess",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
];

const seen = new Set();

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function statInfo(p) {
  try {
    const s = fs.statSync(p);

    return {
      size: s.isFile() ? s.size : null,
      modified: s.mtime.toISOString(),
      type: s.isDirectory() ? "DIR" : "FILE",
    };
  } catch {
    return null;
  }
}

function printFile(p, reason) {
  const key = path.normalize(p).toLowerCase();

  if (seen.has(key)) return;
  seen.add(key);

  const info = statInfo(p);

  if (!info) return;

  console.log("\n--------------------------------------------------");
  console.log("MATCH");
  console.log("Reason :", reason);
  console.log("Path   :", p);
  console.log("Type   :", info.type);

  if (info.size !== null) {
    console.log("Size   :", info.size, "bytes");
  }

  console.log("Modified:", info.modified);
}

function searchDirectory(root) {
  if (!exists(root)) return;

  console.log("\nSEARCHING:", root);

  let entries;

  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(root, entry.name);

    // Avoid following problematic symbolic links.
    if (entry.isSymbolicLink()) continue;

    const lower = entry.name.toLowerCase();

    // Anything directly containing PIN 10.
    if (
      lower === "10.jpg" ||
      lower.includes("cropface") ||
      lower.includes("avatar")
    ) {
      printFile(full, `filename/directory related to PIN ${PIN}`);
    }

    // Search names containing exact PIN-related paths.
    if (
      lower.includes(`\\${PIN}\\`) ||
      lower.includes(`/${PIN}/`) ||
      lower.includes(`_${PIN}`) ||
      lower.includes(`-${PIN}`)
    ) {
      printFile(full, `path contains PIN ${PIN}`);
    }

    if (entry.isDirectory()) {
      searchDirectory(full);
    }
  }
}

console.log("==================================================");
console.log(" ZKBio CVAccess PIN 10 FILE TRACE");
console.log(" READ-ONLY");
console.log("==================================================");

console.log("\nKNOWN DATABASE PATHS:");

for (const p of knownPaths) {
  console.log("  " + p);
}

console.log("\n==================================================");
console.log(" SEARCHING COMMON CVACCESS DIRECTORIES");
console.log("==================================================");

for (const root of roots) {
  searchDirectory(root);
}

console.log("\n==================================================");
console.log(" EXACT FILE SEARCH");
console.log("==================================================");

const exactCandidates = [
  "C:\\upload\\pers\\user\\avatar\\2026-08-29\\10.jpg",
  "C:\\upload\\pers\\user\\cropface\\10\\10.jpg",

  "D:\\upload\\pers\\user\\avatar\\2026-08-29\\10.jpg",
  "D:\\upload\\pers\\user\\cropface\\10\\10.jpg",

  "E:\\upload\\pers\\user\\avatar\\2026-08-29\\10.jpg",
  "E:\\upload\\pers\\user\\cropface\\10\\10.jpg",
];

for (const p of exactCandidates) {
  if (exists(p)) {
    printFile(p, "exact database-referenced path");
  }
}

console.log("\n==================================================");
console.log(" RESULT");
console.log("==================================================");

console.log("Unique matches:", seen.size);

console.log("\nNo files were created, changed, moved, or deleted.");
console.log("==================================================");