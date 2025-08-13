import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export async function initializeClient() {
  const client = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
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
