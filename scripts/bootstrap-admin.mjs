import { createPasswordRecord } from '../api/_lib/auth.js';
import { ensureSchema, sql } from '../api/_lib/db.js';

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
}

await ensureSchema();

const { salt, passwordHash } = createPasswordRecord(adminPassword);

await sql`
  insert into users (email, password_hash, password_salt, role, is_unlimited)
  values (${adminEmail.toLowerCase()}, ${passwordHash}, ${salt}, 'admin', true)
  on conflict (email)
  do update set
    password_hash = excluded.password_hash,
    password_salt = excluded.password_salt,
    role = excluded.role,
    is_unlimited = excluded.is_unlimited
`;

console.log(`Admin user ${adminEmail.toLowerCase()} is ready.`);
await sql.end({ timeout: 5 });
