import { supabaseAdmin } from '~/utils/supabase';
import dotenv from 'dotenv';

dotenv.config();

export async function initializeClient() {
  // Return the Supabase admin client instead of creating a new pg client
  return supabaseAdmin;
}

export async function sleep(number: number) {
  await new Promise((resolve) => setTimeout(resolve, number));
}

export function formatDate(date: string) {
  const datetime = new Date(date);
  return `${datetime.toDateString()} ${datetime.toLocaleTimeString()}`;
}

export function formatDateLocale(date: string) {
  return new Date(date).toLocaleString();
}

export function getDuration(start: number, end?: number) {
  const startTime = new Date(start);
  let endTime;
  if (!end) {
    endTime = new Date(Date.now());
  } else {
    endTime = new Date(end);
  }
  const duration = +endTime - +startTime;
  return duration / 1000;
}
