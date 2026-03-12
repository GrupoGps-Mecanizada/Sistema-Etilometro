'use strict';

/**
 * SGE_ETL — Supabase Configuration
 * Mirrors the same pattern as Gestão Efetivo:
 *   - Uses window.supabase (the CDN global) to create the client
 *   - Overwrites window.supabase with the client instance
 *   - All API calls use .schema('gps_mec') per-query
 */
window.SGE_ETL = window.SGE_ETL || {};

// Same project credentials as Gestão Efetivo
const SUPABASE_URL = 'https://mgcjidryrjqiceielmzp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nY2ppZHJ5cmpxaWNlaWVsbXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjEwNzEsImV4cCI6MjA4NzY5NzA3MX0.UAKkzy5fMIkrlmnqz9E9KknUw9xhoYpa3f1ptRpOuAA';

SGE_ETL.SUPABASE_URL = SUPABASE_URL;
SGE_ETL.SUPABASE_KEY = SUPABASE_KEY;

if (typeof supabase !== 'undefined' && supabase.createClient) {
    // Overwrite window.supabase with the initialized client (same pattern as Gestão Efetivo)
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.info('SGE_ETL: Supabase client initialized.');
} else {
    console.warn('SGE_ETL: Supabase CDN script not loaded.');
}
