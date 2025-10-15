import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export async function initializeClient() {
  const client = new pg.Client({
    user: process.env.DATABASE_USER || '',
    host: process.env.DATABASE_ADDRESS || 'localhost',
    database: process.env.DATABASE_NAME || '',
    password: process.env.DATABASE_PASSWORD || '',
    port: parseInt(process.env.DATABASE_PORT || '5433', 10),
  });

  try {
    await client.connect();
    console.log('Connected to the database successfully');
    return client;
  } catch (error) {
    console.error('Error connecting to the database:', error);
    throw error;
  }
}

export async function sleep(number: number) {
  await new Promise((resolve) => setTimeout(resolve, number));
}

// Date formatting utilities
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
