const fs = require("fs");

const url = process.env.SUPABASE_URL || "https://[PROJECT-ID].supabase.co";
const key = process.env.SUPABASE_KEY || "[YOUR-ANON-PUBLIC-KEY]";

const envContent = `const SUPABASE_URL = "${url}";\nconst SUPABASE_KEY = "${key}";\n`;

fs.writeFileSync("env.js", envContent);
console.log("env.js has been generated successfully.");
