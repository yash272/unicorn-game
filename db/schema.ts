import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const playtestSignups = sqliteTable('playtest_signups', {
  id:text('id').primaryKey(),
  name:text('name').notNull(),
  email:text('email').notNull(),
  city:text('city').notNull(),
  friends:integer('friends').notNull(),
  createdAt:text('created_at').notNull(),
}, (table) => [uniqueIndex('playtest_signups_email_unique').on(table.email)]);
