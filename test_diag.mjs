const URL = "https://lpjdpcguplkpdfgxomps.supabase.co/functions/v1";
const HEADERS = {
  "Content-Type": "application/json",
  "apikey": "sb_publishable_51kPQ-pyABP2B8gK4aAkrQ_p3BPRnxJ",
  "Authorization": "Bearer sb_publishable_51kPQ-pyABP2B8gK4aAkrQ_p3BPRnxJ",
};

console.log("=== RAW /users RESPONSE ===");
const usersRes = await fetch(`${URL}/users`, { headers: HEADERS });
const usersText = await usersRes.text();
console.log("Status:", usersRes.status);
console.log("Body:", usersText.slice(0, 2000));

console.log("\n=== LOGIN: ANASNAJI@gmail.com / password ===");
const r1 = await fetch(`${URL}/login`, {
  method: "POST",
  headers: HEADERS,
  body: JSON.stringify({ email: "ANASNAJI@gmail.com", password: "password" }),
});
console.log("Status:", r1.status, "Body:", await r1.text());

console.log("\n=== LOGIN: anasnaji@gmail.com / password ===");
const r2 = await fetch(`${URL}/login`, {
  method: "POST",
  headers: HEADERS,
  body: JSON.stringify({ email: "anasnaji@gmail.com", password: "password" }),
});
console.log("Status:", r2.status, "Body:", await r2.text());