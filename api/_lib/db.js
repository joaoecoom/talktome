import postgres from 'postgres';
import process from 'node:process';

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  throw new Error('Database connection is not configured.');
}

export const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 15,
});

let schemaPromise;

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = sql.begin(async (tx) => {
      await tx`
        create table if not exists users (
          id bigserial primary key,
          email text not null unique,
          password_hash text not null,
          password_salt text not null,
          role text not null default 'user',
          is_unlimited boolean not null default false,
          created_at timestamptz not null default now()
        )
      `;

      await tx`
        create table if not exists sessions (
          id bigserial primary key,
          user_id bigint not null references users(id) on delete cascade,
          token_hash text not null unique,
          expires_at timestamptz not null,
          created_at timestamptz not null default now()
        )
      `;

      await tx`
        create table if not exists usage_logs (
          id bigserial primary key,
          user_id bigint not null references users(id) on delete cascade,
          action text not null,
          input_chars integer not null default 0,
          created_at timestamptz not null default now()
        )
      `;

      await tx`create index if not exists sessions_user_id_idx on sessions (user_id)`;
      await tx`create index if not exists sessions_expires_at_idx on sessions (expires_at)`;
      await tx`create index if not exists usage_logs_user_id_created_at_idx on usage_logs (user_id, created_at desc)`;
    });
  }

  return schemaPromise;
}
