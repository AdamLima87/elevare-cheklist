import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nvkfgczahyxzgoomkavk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52a2ZnY3phaHl4emdvb21rYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTYxNDksImV4cCI6MjA5ODQ5MjE0OX0.LmAdeabGS4tPw5vShznylA0I2QHnrNoPCtOp0w9Gg-E";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
