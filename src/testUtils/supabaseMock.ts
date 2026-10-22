/**
 * A tiny in-memory stand-in for @supabase/supabase-js, just enough to
 * exercise the store logic in src/store/*.ts (which are otherwise thin
 * wrappers around supabase.from()/rpc() calls). The RPCs are re-implemented
 * here in JS to mirror the real SQL functions in DramaRush-Backend
 * (20261009150000_lock_down_entitlements.sql, 20261019120000_account_rules.sql):
 * entitlement tables are read-only for clients, coins / unlocks / membership
 * only change through RPCs, every account starts with 0 coins, and guests
 * (anonymous sessions, and device guests from guest-session) get
 * 'account_required' from the member-only RPCs (everything but ad unlocks).
 * The SQL itself is tested separately against Postgres
 * (DramaRush-Backend/supabase/tests) — this does not replace that.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';

type Row = Record<string, any>;

interface State {
  userId: string | null;
  isAdmin: boolean;
  tables: Record<string, Row[]>;
  /** Tables whose reads fail (see __setQueryError). */
  queryErrors: Record<string, { message: string; code?: string }>;
}

/** Tables clients may only read (writes go through RPCs), as on the real backend. */
const READ_ONLY_TABLES = new Set([
  'wallets',
  'transactions',
  'subscriptions',
  'unlocks',
  'daily_mission_claims',
  'app_config',
  'coin_packages',
  'subscription_plans',
]);

/** The RPCs private.require_member() guards: guests must link an account
 * first. redeem_ad_reward isn't one — guests may unlock ad episodes (the
 * daily cap applies to them too). */
const MEMBER_ONLY_RPCS = new Set([
  'unlock_episode_with_coins',
  'claim_daily_mission',
  'simulate_purchase',
  'simulate_subscribe',
]);

const TEST_USER_ID = 'test-user-1';

/** Same rows (and values) as the public app_config rows on the real backend. */
function defaultConfig(): Row[] {
  return [
    { key: 'simulated_payments', value: true, is_public: true },
    { key: 'welcome_bonus_coins', value: 150, is_public: true },
    { key: 'daily_mission_reward', value: 20, is_public: true },
    { key: 'ad_unlocks_per_day', value: 20, is_public: true },
    { key: 'starting_coins_guest', value: 0, is_public: false },
  ];
}

function emptySubscription(userId: string): Row {
  return {
    user_id: userId,
    is_active: false,
    plan_id: null,
    started_at: null,
    renews_at: null,
    cancelled_at: null,
    bonus_granted_at: null,
  };
}

function defaultTables(): Record<string, Row[]> {
  return {
    wallets: [{ user_id: TEST_USER_ID, balance: 0, updated_at: new Date().toISOString() }],
    transactions: [],
    subscriptions: [emptySubscription(TEST_USER_ID)],
    favorites: [],
    unlocks: [],
    watch_history: [],
    progress: [],
    recent_searches: [],
    daily_mission_claims: [],
    episodes: [
      { id: 'ep-coin', series_id: 'series-1', number: 1, title: 'Coin Episode', access: 'coin', coin_price: 20 },
      { id: 'ep-ad', series_id: 'series-1', number: 2, title: 'Ad Episode', access: 'ad_unlock', coin_price: null },
      { id: 'ep-free', series_id: 'series-1', number: 3, title: 'Free Episode', access: 'free', coin_price: null },
      { id: 'ep-member', series_id: 'series-1', number: 4, title: 'Member Episode', access: 'subscriber', coin_price: null },
    ],
    series: [{ id: 'series-1', title: 'Test Series' }],
    app_config: defaultConfig(),
    // The seed rows of 20261009150000_lock_down_entitlements.sql.
    coin_packages: [
      { id: 'coins-100', coins: 100, bonus_coins: 0, price_usd: 0.99, badge: null, sort_order: 1, active: true },
      { id: 'coins-250', coins: 250, bonus_coins: 25, price_usd: 2.99, badge: '+10% bonus', sort_order: 2, active: true },
      { id: 'coins-600', coins: 600, bonus_coins: 90, price_usd: 6.99, badge: '+15% bonus', sort_order: 3, active: true },
      { id: 'coins-1500', coins: 1500, bonus_coins: 300, price_usd: 14.99, badge: '+20% bonus', sort_order: 4, active: true },
    ],
    subscription_plans: [
      { id: 'monthly', title: 'Monthly Membership', price_usd: 8.99, billing_period: '1 mon', bonus_coins: 100, sort_order: 1, active: true },
      { id: 'annual', title: 'Annual Membership', price_usd: 59.99, billing_period: '1 year', bonus_coins: 1500, sort_order: 2, active: true },
    ],
  };
}

const state: State = { userId: TEST_USER_ID, isAdmin: true, tables: defaultTables(), queryErrors: {} };

export function __reset() {
  state.userId = TEST_USER_ID;
  state.isAdmin = true;
  state.tables = defaultTables();
  state.queryErrors = {};
  invokeHandler = defaultInvokeHandler;
  resetAuth();
}

export function __setAdmin(isAdmin: boolean) {
  state.isAdmin = isAdmin;
}

/** app_config.simulated_payments. */
export function __setSimulatedPayments(enabled: boolean) {
  __setConfig('simulated_payments', enabled);
}

export function __setConfig(key: string, value: unknown) {
  const row = state.tables.app_config.find((r) => r.key === key);
  if (row) row.value = value;
  else state.tables.app_config.push({ key, value, is_public: true });
}

/**
 * Who the mock server thinks is calling. `anonymous` marks the account as a
 * guest (an anonymous session): member-only RPCs then raise
 * 'account_required' and playback-token refuses coin / member episodes.
 */
export function __setUserId(userId: string | null, opts: { anonymous?: boolean } = {}) {
  state.userId = userId;
  if (userId && opts.anonymous !== undefined) {
    if (opts.anonymous) anonymousUsers.add(userId);
    else anonymousUsers.delete(userId);
  }
}

/** Server-side balance (what the client can't write itself). */
export function __setBalance(userId: string, balance: number) {
  const wallet = state.tables.wallets.find((w) => w.user_id === userId);
  if (wallet) wallet.balance = balance;
  else state.tables.wallets.push({ user_id: userId, balance, updated_at: new Date().toISOString() });
}

/** Makes every read of `table` fail with `error` until cleared with null. */
export function __setQueryError(table: string, error: { message: string; code?: string } | null) {
  if (error) state.queryErrors[table] = error;
  else delete state.queryErrors[table];
}

export function __getTable(name: string): Row[] {
  return state.tables[name] ?? [];
}

type Filter = { type: 'eq'; col: string; val: unknown } | { type: 'in'; col: string; vals: unknown[] };

class MockQueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = [];
  private opType: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any = null;
  private upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean } | undefined;
  private wantSingle = false;
  private wantMaybe = false;
  private rowLimit: number | null = null;

  constructor(private tableName: string) {}

  select(_cols?: string) {
    return this;
  }
  insert(payload: any) {
    this.opType = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.opType = 'update';
    this.payload = payload;
    return this;
  }
  delete() {
    this.opType = 'delete';
    return this;
  }
  upsert(payload: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.opType = 'upsert';
    this.payload = payload;
    this.upsertOpts = opts;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push({ type: 'in', col, vals });
    return this;
  }
  order(_col?: string, _opts?: unknown) {
    return this;
  }
  limit(n: number) {
    this.rowLimit = n;
    return this;
  }
  maybeSingle() {
    this.wantSingle = true;
    this.wantMaybe = true;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => (f.type === 'eq' ? row[f.col] === f.val : f.vals.includes(row[f.col])));
  }

  private execute(): { data: any; error: any } {
    if (this.opType === 'select' && state.queryErrors[this.tableName]) {
      return { data: null, error: state.queryErrors[this.tableName] };
    }
    if (this.opType !== 'select' && READ_ONLY_TABLES.has(this.tableName)) {
      return { data: null, error: { code: '42501', message: `permission denied for table ${this.tableName}` } };
    }
    const table = state.tables[this.tableName] ?? (state.tables[this.tableName] = []);
    let resultRows: Row[] = [];

    switch (this.opType) {
      case 'select':
        resultRows = table.filter((r) => this.matches(r));
        if (this.rowLimit !== null) resultRows = resultRows.slice(0, this.rowLimit);
        break;
      case 'insert': {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        table.push(...items);
        resultRows = items;
        break;
      }
      case 'update':
        table.forEach((r, i) => {
          if (this.matches(r)) table[i] = { ...r, ...this.payload };
        });
        resultRows = table.filter((r) => this.matches(r));
        break;
      case 'delete': {
        const removed = table.filter((r) => this.matches(r));
        state.tables[this.tableName] = table.filter((r) => !this.matches(r));
        resultRows = removed;
        break;
      }
      case 'upsert': {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const conflictCols = (this.upsertOpts?.onConflict ?? 'user_id').split(',');
        items.forEach((item) => {
          const idx = table.findIndex((r) => conflictCols.every((c) => r[c] === item[c]));
          if (idx >= 0) {
            if (!this.upsertOpts?.ignoreDuplicates) table[idx] = { ...table[idx], ...item };
          } else {
            table.push(item);
          }
        });
        resultRows = items;
        break;
      }
    }

    if (this.wantSingle) {
      const row = resultRows[0] ?? null;
      if (!row && !this.wantMaybe) return { data: null, error: { message: 'no rows found' } };
      return { data: row, error: null };
    }
    return { data: resultRows, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function makeTransaction(type: string, label: string, amount: number) {
  return {
    id: `txn-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    user_id: state.userId,
    type,
    label,
    amount,
    created_at: new Date().toISOString(),
  };
}

function config<T>(key: string, fallback: T): T {
  const row = state.tables.app_config.find((r) => r.key === key);
  return row ? (row.value as T) : fallback;
}

/** private.is_guest(): an anonymous session, or a device guest (a normal
 * user whose profile still says provider 'guest'). */
function isGuest(userId: string): boolean {
  if (anonymousUsers.has(userId)) return true;
  return deviceGuestUsers.has(userId) && state.tables.profiles?.find((p) => p.user_id === userId)?.provider === 'guest';
}

/** Postgres interval text as PostgREST returns it ('1 mon', '1 year') -> renewal date. */
function addBillingPeriod(from: Date, period: string): Date {
  const next = new Date(from);
  if (/year/.test(period)) next.setFullYear(next.getFullYear() + parseInt(period, 10));
  else next.setMonth(next.getMonth() + parseInt(period, 10));
  return next;
}

async function rpc(name: string, params: Record<string, unknown>) {
  const userId = state.userId;
  if (!userId) return { data: null, error: { message: 'not_authenticated' } };
  if (MEMBER_ONLY_RPCS.has(name) && isGuest(userId)) return { data: null, error: { message: 'account_required' } };

  const wallet = () => {
    let row = state.tables.wallets.find((w) => w.user_id === userId);
    if (!row) {
      row = { user_id: userId, balance: 0, updated_at: new Date().toISOString() };
      state.tables.wallets.push(row);
    }
    return row;
  };
  const subscription = () => {
    let row = state.tables.subscriptions.find((s) => s.user_id === userId);
    if (!row) {
      row = emptySubscription(userId);
      state.tables.subscriptions.push(row);
    }
    return row;
  };
  const paymentsDisabled = { data: null, error: { message: 'payments_disabled' } };
  const adminOnly = { data: null, error: { message: 'admin_only' } };
  const simulatedPayments = () => config('simulated_payments', true) === true;

  if (name === 'unlock_episode_with_coins') {
    const episodeId = params.p_episode_id as string;
    if (state.tables.unlocks.some((u) => u.user_id === userId && u.episode_id === episodeId)) {
      return { data: true, error: null };
    }
    const episode = state.tables.episodes.find((e) => e.id === episodeId);
    if (!episode || episode.access !== 'coin' || episode.coin_price == null) {
      return { data: null, error: { message: `episode ${episodeId} is not a coin-unlock episode` } };
    }
    if (wallet().balance < episode.coin_price) {
      return { data: false, error: null };
    }
    wallet().balance -= episode.coin_price;
    wallet().updated_at = new Date().toISOString();
    state.tables.unlocks.push({ user_id: userId, episode_id: episodeId });
    state.tables.transactions.unshift(makeTransaction('unlock', `Unlocked ${episode.title}`, -episode.coin_price));
    return { data: true, error: null };
  }

  if (name === 'redeem_ad_reward') {
    const episodeId = params.p_episode_id as string;
    if (state.tables.unlocks.some((u) => u.user_id === userId && u.episode_id === episodeId)) {
      return { data: true, error: null };
    }
    const episode = state.tables.episodes.find((e) => e.id === episodeId);
    if (!episode || episode.access !== 'ad_unlock') {
      return { data: null, error: { message: `episode ${episodeId} is not an ad-unlock episode` } };
    }
    const today = new Date().toISOString().slice(0, 10);
    const adUnlocksToday = state.tables.unlocks.filter(
      (u) => u.user_id === userId && u.via === 'ad' && String(u.created_at).startsWith(today)
    ).length;
    if (adUnlocksToday >= config('ad_unlocks_per_day', 20)) return { data: false, error: null };
    state.tables.unlocks.push({ user_id: userId, episode_id: episodeId, via: 'ad', created_at: new Date().toISOString() });
    state.tables.transactions.unshift(makeTransaction('reward', 'Unlocked via rewarded ad', 0));
    return { data: true, error: null };
  }

  if (name === 'claim_daily_mission') {
    const today = new Date().toISOString().slice(0, 10);
    if (state.tables.daily_mission_claims.some((c) => c.user_id === userId && c.claim_date === today)) {
      return { data: 0, error: null };
    }
    const reward = config('daily_mission_reward', 20);
    state.tables.daily_mission_claims.push({ user_id: userId, claim_date: today, coins_awarded: reward });
    wallet().balance += reward;
    wallet().updated_at = new Date().toISOString();
    state.tables.transactions.unshift(makeTransaction('reward', 'Daily mission: watched a rewarded ad', reward));
    return { data: reward, error: null };
  }

  if (name === 'simulate_purchase') {
    if (!simulatedPayments()) return paymentsDisabled;
    const pkg = state.tables.coin_packages.find((p) => p.id === params.p_package_id && p.active);
    if (!pkg) return { data: null, error: { message: `package ${params.p_package_id} not found` } };
    const coins = pkg.coins + pkg.bonus_coins;
    wallet().balance += coins;
    state.tables.transactions.unshift(makeTransaction('purchase', `Purchased ${pkg.coins} coins ($${pkg.price_usd})`, coins));
    return { data: wallet().balance, error: null };
  }

  if (name === 'simulate_subscribe') {
    if (!simulatedPayments()) return paymentsDisabled;
    const plan = state.tables.subscription_plans.find((p) => p.id === params.p_plan_id && p.active);
    if (!plan) return { data: null, error: { message: `plan ${params.p_plan_id} not found` } };
    const prev = subscription();
    const now = new Date();
    const running = prev.is_active && (!prev.renews_at || Date.parse(prev.renews_at) > now.getTime());
    // The bonus is paid at most once per billing period (S1: subscribe ->
    // cancel -> subscribe used to pay it every time).
    const bonusPaidThisPeriod = !!prev.bonus_granted_at && addBillingPeriod(new Date(prev.bonus_granted_at), plan.billing_period) > now;
    const grant = plan.bonus_coins > 0 && !running && !bonusPaidThisPeriod;
    Object.assign(prev, {
      is_active: true,
      plan_id: plan.id,
      started_at: now.toISOString(),
      renews_at: addBillingPeriod(now, plan.billing_period).toISOString(),
      cancelled_at: null,
      bonus_granted_at: grant ? now.toISOString() : prev.bonus_granted_at,
    });
    if (grant) {
      wallet().balance += plan.bonus_coins;
      state.tables.transactions.unshift(makeTransaction('bonus', `${plan.title} bonus`, plan.bonus_coins));
    }
    return { data: { ...prev }, error: null };
  }

  if (name === 'cancel_subscription') {
    if (!simulatedPayments()) return paymentsDisabled;
    // Access continues until renews_at; the server's hourly job flips
    // is_active once that has passed.
    const sub = subscription();
    if (sub.is_active && !sub.cancelled_at) sub.cancelled_at = new Date().toISOString();
    return { data: { ...sub }, error: null };
  }

  if (name === 'reset_my_data') {
    if (!simulatedPayments()) return paymentsDisabled;
    for (const t of ['favorites', 'unlocks', 'watch_history', 'progress', 'recent_searches', 'transactions', 'daily_mission_claims']) {
      state.tables[t] = state.tables[t].filter((r) => r.user_id !== userId);
    }
    wallet().balance = 0;
    Object.assign(subscription(), { is_active: false, plan_id: null, started_at: null, renews_at: null, cancelled_at: null });
    return { data: null, error: null };
  }

  if (name === 'demo_set_balance') {
    if (!simulatedPayments()) return paymentsDisabled;
    if (!state.isAdmin) return adminOnly;
    const next = params.p_balance as number;
    const old = wallet().balance;
    wallet().balance = next;
    state.tables.transactions.unshift(makeTransaction('reset', `Demo controls: balance set to ${next}`, next - old));
    return { data: next, error: null };
  }

  if (name === 'demo_set_all_unlocked') {
    if (!simulatedPayments()) return paymentsDisabled;
    if (!state.isAdmin) return adminOnly;
    state.tables.unlocks = state.tables.unlocks.filter((u) => u.user_id !== userId);
    if (params.p_unlocked) {
      for (const e of state.tables.episodes.filter((ep) => ep.access !== 'free')) {
        state.tables.unlocks.push({ user_id: userId, episode_id: e.id });
      }
    }
    return { data: null, error: null };
  }

  return { data: null, error: { message: `unknown rpc ${name}` } };
}

/* ---------- Edge Functions ---------- */
type InvokeHandler = (name: string, body: unknown) => Promise<{ data: any; error: any }>;

function httpError(status: number, code: string) {
  return { data: null, error: new FunctionsHttpError({ status, json: async () => ({ error: code }) }) };
}

/**
 * playback-token as the real function decides it (authorize_playback): free,
 * unlocked and (for active members) subscriber episodes play, in full, for
 * guests too. A guest is told 'not_entitled' on an ad episode they haven't
 * unlocked (the app offers the ad) and 'account_required' on coin and member
 * episodes.
 */
async function playbackToken(body: unknown) {
  const userId = state.userId;
  if (!userId) return httpError(401, 'not_authenticated');
  const episodeId = (body as { episode_id?: string } | null)?.episode_id;
  const episode = state.tables.episodes.find((e) => e.id === episodeId);
  if (!episode) return httpError(403, 'not_entitled');

  const base = {
    episode_id: episode.id,
    hls_url: `https://customer-test.cloudflarestream.com/${userId}-${episode.id}/manifest/video.m3u8`,
    dash_url: `https://customer-test.cloudflarestream.com/${userId}-${episode.id}/manifest/video.mpd`,
    thumbnail_url: `https://customer-test.cloudflarestream.com/${userId}-${episode.id}/thumbnails/thumbnail.jpg`,
    watermark_code: 'TEST234',
  };

  if (isGuest(userId) && episode.access !== 'free' && episode.access !== 'ad_unlock') {
    return httpError(403, 'account_required');
  }

  const sub = state.tables.subscriptions.find((s) => s.user_id === userId);
  const member = !!sub?.is_active && (!sub.renews_at || Date.parse(sub.renews_at) > Date.now());
  const entitled =
    episode.access === 'free' ||
    state.tables.unlocks.some((u) => u.user_id === userId && u.episode_id === episode.id) ||
    (episode.access === 'subscriber' && member);
  if (!entitled) return httpError(403, 'not_entitled');
  return { data: { ...base, expires_at: new Date(Date.now() + 15 * 60_000).toISOString() }, error: null };
}

/**
 * guest-session as the real function answers it: the same device key always
 * maps to the same (non-anonymous, provider 'guest', 0-coin) user, a new key
 * makes a new one until the per-IP cap (__setGuestSessionLimit) says 429. It
 * only returns tokens; the app signs in with auth.setSession().
 */
async function guestSession(body: unknown) {
  const deviceKey = (body as { device_key?: unknown } | null)?.device_key;
  if (typeof deviceKey !== 'string' || !/^[A-Za-z0-9._-]{8,128}$/.test(deviceKey)) return httpError(400, 'bad_request');
  let userId = deviceGuests.get(deviceKey);
  if (!userId) {
    if (guestSessionLimit !== null && deviceGuests.size >= guestSessionLimit) return httpError(429, 'guest_limit');
    userId = `device-guest-${deviceGuests.size + 1}`;
    deviceGuests.set(deviceKey, userId);
    deviceGuestUsers.add(userId);
    createAccountRows(userId);
  }
  const refreshToken = `refresh-${userId}-${++issuedTokenCounter}`;
  issuedRefreshTokens.set(refreshToken, userId);
  return {
    data: { access_token: `token-${userId}`, refresh_token: refreshToken, expires_in: 3600, user_id: userId },
    error: null,
  };
}

const defaultInvokeHandler: InvokeHandler = async (name, body) => {
  if (name === 'playback-token') return playbackToken(body);
  if (name === 'guest-session') return guestSession(body);
  return { data: null, error: new Error(`no mock for function ${name}`) };
};

let invokeHandler: InvokeHandler = defaultInvokeHandler;

/** Replaces the Edge Function handler (until the next __reset()). */
export function __setInvokeHandler(handler: InvokeHandler) {
  invokeHandler = handler;
}

/* ---------- auth ----------
 * A controllable stand-in for supabase.auth: tests drive onAuthStateChange
 * listeners with __emitAuthEvent, and the calls the app makes (guest
 * sign-in, sign-out) emit the same events the real client does. */
type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
type AuthCallback = (event: AuthEvent, session: MockSession | null) => void;

export interface MockSession {
  access_token: string;
  user: {
    id: string;
    is_anonymous: boolean;
    email?: string;
    phone?: string;
    created_at: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
    identities?: { provider: string }[];
  };
}

const authListeners = new Set<AuthCallback>();
const anonymousUsers = new Set<string>();
/** device_key -> user id, as private.device_guests keeps it. */
const deviceGuests = new Map<string, string>();
const deviceGuestUsers = new Set<string>();
/** Refresh tokens guest-session handed out, redeemable once with setSession. */
const issuedRefreshTokens = new Map<string, string>();
let issuedTokenCounter = 0;
let guestSessionLimit: number | null = null;
let guestCounter = 0;
let signOutError: { message: string; status?: number } | null = null;

function resetAuth() {
  authListeners.clear();
  anonymousUsers.clear();
  deviceGuests.clear();
  deviceGuestUsers.clear();
  issuedRefreshTokens.clear();
  issuedTokenCounter = 0;
  guestSessionLimit = null;
  guestCounter = 0;
  signOutError = null;
}

/** guest_new_per_ip_per_day: how many device guests guest-session may create (null = no cap). */
export function __setGuestSessionLimit(limit: number | null) {
  guestSessionLimit = limit;
}

/** device_key -> user id for every device guest created so far. */
export function __deviceGuests(): Map<string, string> {
  return new Map(deviceGuests);
}

export function __makeSession(userId: string, opts: { isAnonymous?: boolean } = {}): MockSession {
  // A device guest is an email user under the synthetic guest domain.
  const device = deviceGuestUsers.has(userId);
  return {
    access_token: `token-${userId}`,
    user: {
      id: userId,
      is_anonymous: opts.isAnonymous ?? anonymousUsers.has(userId),
      ...(device ? { email: `d-${userId}@guest.kbbox.app` } : null),
      created_at: '2026-10-01T00:00:00.000Z',
      app_metadata: device ? { provider: 'email', providers: ['email'] } : {},
      user_metadata: device ? { provider: 'guest', display_name: 'Guest Viewer', device: true } : {},
      ...(device ? { identities: [{ provider: 'email' }] } : null),
    },
  };
}

/** Delivers an auth event to every onAuthStateChange listener, as supabase-js does. */
export function __emitAuthEvent(event: AuthEvent, session: MockSession | null) {
  authListeners.forEach((cb) => cb(event, session));
}

export function __authListenerCount() {
  return authListeners.size;
}

export function __setSignOutError(error: { message: string; status?: number } | null) {
  signOutError = error;
}

/** What handle_new_user() creates for a new account (guests start with 0 coins). */
function createAccountRows(userId: string) {
  state.tables.wallets.push({ user_id: userId, balance: 0, updated_at: new Date().toISOString() });
  state.tables.subscriptions.push(emptySubscription(userId));
  (state.tables.profiles ??= []).push({
    user_id: userId,
    display_name: 'Guest Viewer',
    avatar_seed: 'Guest Viewer',
    is_admin: false,
    public_code: null,
    provider: 'guest',
  });
}

const auth = {
  getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }),
  getSession: async () => ({ data: { session: state.userId ? __makeSession(state.userId) : null }, error: null }),
  onAuthStateChange: (cb: AuthCallback) => {
    authListeners.add(cb);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
  },
  signInAnonymously: async (_opts?: unknown) => {
    const userId = `guest-${++guestCounter}`;
    anonymousUsers.add(userId);
    createAccountRows(userId);
    state.userId = userId;
    const session = __makeSession(userId);
    __emitAuthEvent('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },
  /** Only accepts a refresh token guest-session issued (each one once, as GoTrue rotates them). */
  setSession: async ({ refresh_token }: { access_token: string; refresh_token: string }) => {
    const userId = issuedRefreshTokens.get(refresh_token);
    if (!userId) return { data: { session: null, user: null }, error: { message: 'Invalid Refresh Token: Refresh Token Not Found', status: 400 } };
    issuedRefreshTokens.delete(refresh_token);
    state.userId = userId;
    const session = __makeSession(userId);
    __emitAuthEvent('SIGNED_IN', session);
    return { data: { session, user: session.user }, error: null };
  },
  signOut: async (_opts?: { scope?: 'global' | 'local' | 'others' }) => {
    if (signOutError) return { error: signOutError };
    state.userId = null;
    __emitAuthEvent('SIGNED_OUT', null);
    return { error: null };
  },
};

export const supabase = {
  auth,
  from: (table: string) => new MockQueryBuilder(table),
  rpc,
  functions: {
    invoke: (name: string, opts?: { body?: unknown }) => invokeHandler(name, opts?.body),
  },
};
