import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const gameRooms = sqliteTable("game_rooms", {
  code: text("code").primaryKey(),
  state: text("state").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

const campaignColumns = () => ({
  utmSource: text('utm_source'), utmMedium: text('utm_medium'), utmCampaign: text('utm_campaign'),
  utmContent: text('utm_content'), utmTerm: text('utm_term'), referrerHost: text('referrer_host'),
});
export const launchSubscribers = sqliteTable('launch_subscribers', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(), createdAt: integer('created_at').notNull(),
  consentVersion: text('consent_version').notNull(), status: text('status').notNull().default('subscribed'),
  sessionId: text('session_id').notNull(), ctaLocation: text('cta_location').notNull(), ...campaignColumns(),
});
export const funnelEvents = sqliteTable('funnel_events', {
  id: text('id').primaryKey(), name: text('name').notNull(), sessionId: text('session_id').notNull(),
  ctaLocation: text('cta_location').notNull(), createdAt: integer('created_at').notNull(), ...campaignColumns(),
}, table => [uniqueIndex('funnel_event_once').on(table.sessionId, table.name, table.ctaLocation), index('funnel_events_created').on(table.createdAt), index('funnel_events_campaign').on(table.utmCampaign, table.name)]);
export const funnelRateLimits = sqliteTable('funnel_rate_limits', {
  key: text('key').primaryKey(), hits: integer('hits').notNull().default(1), expiresAt: integer('expires_at').notNull(),
}, table => [index('funnel_rate_expiry').on(table.expiresAt)]);
