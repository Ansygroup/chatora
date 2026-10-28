/* Chatora — public runtime config.
   Supabase anon key, Meta App ID, Login for Business config IDs, provider mode,
   and Graph version are public/browser values. Never put a service_role key,
   Meta App Secret, system-user token, or encryption key here. */
window.CHATORA_CONFIG = {
  SUPABASE_URL: "https://sytogavpspwgjadorprn.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dG9nYXZwc3B3Z2phZG9ycHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNTU2MTYsImV4cCI6MjEwODYzMTYxNn0.gdXcMbteIlMYc1Q5mRwv5NuDHm952XA_SsC4GOHrDAM",
  META_APP_ID: "",
  META_WHATSAPP_CONFIG_ID: "",
  META_INSTAGRAM_CONFIG_ID: "",
  META_WHATSAPP_PROVIDER_TYPE: "tech_provider", // user-selected; approval is not verified
  META_GRAPH_API_VERSION: "v26.0",
  META_SEND_ENABLED: false, // public UI gate only; Supabase META_SEND_ENABLED is authoritative
  TIMEOUT_MS: 9000
};
