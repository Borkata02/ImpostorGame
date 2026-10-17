// js/supabase.js
const SUPABASE_URL = 'https://yuijxlkflzorrkehmxrq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1aWp4bGtmbHpvcnJrZWhteHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNTAzNDYsImV4cCI6MjEwNzgyNjM0Nn0.SGsrLUouRCZ41Cpu9Snwg6xIFcSsnL3xlYwY6bm9frQ';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);