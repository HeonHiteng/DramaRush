/**
 * A tiny in-memory stand-in for @supabase/supabase-js, just enough to
 * exercise the store logic in src/store/*.ts (which are otherwise thin
 * wrappers around supabase.from()/rpc() calls). The RPCs are re-implemented
 * here in JS to mirror the real SQL functions in DramaRush-Backend
 * (20261009150000_lock_down_entitlements.sql): entitlement tables are
 * read-only for clients, and coins / unlocks / membership only change
 * through RPCs. The SQL itself is tested separately against Postgres
 * (DramaRush-Backend/supabase/tests) — this does not replace that.
 */
import { COIN_PACKAGES, SUBSCRIPTION_PLANS } from '../data/wallet';

type Row = Record<string, any>;

interface State {
  userId: string | null;
  isAdmin: boolean;
  simulatedPayments: boolean;
  tables: Record<string, Row[]>;
}

/** Tables clients may only read (writes go through RPCs), as on the real backend. */
const READ_ONLY_TABLES = new Set(['wallets', 'transactions', 'subscriptions', 'unlocks', 'daily_mission_claims']);
const STARTING_BALANCE = 150;
const AD_UNLOCKS_PER_DAY = 20;

const TEST_USER_ID = 'test-user-1';

function defaultTables(): Record<string, Row[]> {
  return {
    wallets: [{ user_id: TEST_USER_ID, balance: 150, updated_at: new Date().toISOString() }],
    transactions: [],
    subscriptions: [{ user_id: TEST_USER_ID, is_active: false, plan_id: null, started_at: null, renews_at: null }],
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
    ],
    series: [{ id: 'series-1', title: 'Test Series' }],
  };
}

const state: State = { userId: TEST_USER_ID, isAdmin: true, simulatedPayments: true, tables: defaultTables() };

export function __reset() {
  state.userId = TEST_USER_ID;
  state.isAdmin = true;
  state.simulatedPayments = true;
  state.tables = defaultTables();
}

export function __setAdmin(isAdmin: boolean) {
  state.isAdmin = isAdmin;
}

export function __setSimulatedPayments(enabled: boolean) {
  state.simulatedPayments = enabled;
}

export function __setUserId(userId: string | null) {
  state.userId = userId;
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
  limit(_n: number) {
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
    if (this.opType !== 'select' && READ_ONLY_TABLES.has(this.tableName)) {
      return { data: null, error: { code: '42501', message: `permission denied for table ${this.tableName}` } };
    }
    const table = state.tables[this.tableName] ?? (state.tables[this.tableName] = []);
    let resultRows: Row[] = [];

    switch (this.opType) {
      case 'select':
        resultRows = table.filter((r) => this.matches(r));
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

async function rpc(name: string, params: Record<string, unknown>) {
  const userId = state.userId;
  if (!userId) return { data: null, error: { message: 'not authenticated' } };

  if (name === 'unlock_episode_with_coins') {
    const episodeId = params.p_episode_id as string;
    if (state.tables.unlocks.some((u) => u.user_id === userId && u.episode_id === episodeId)) {
      return { data: true, error: null };
    }
    const episode = state.tables.episodes.find((e) => e.id === episodeId);
    if (!episode || episode.access !== 'coin' || episode.coin_price == null) {
      return { data: null, error: { message: `episode ${episodeId} is not a coin-unlock episode` } };
    }
    const wallet = state.tables.wallets.find((w) => w.user_id === userId);
    if (!wallet || wallet.balance < episode.coin_price) {
      return { data: false, error: null };
    }
    wallet.balance -= episode.coin_price;
    wallet.updated_at = new Date().toISOString();
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
    if (adUnlocksToday >= AD_UNLOCKS_PER_DAY) return { data: false, error: null };
    state.tables.unlocks.push({ user_id: userId, episode_id: episodeId, via: 'ad', created_at: new Date().toISOString() });
    state.tables.transactions.unshift(makeTransaction('reward', 'Unlocked via rewarded ad', 0));
    return { data: true, error: null };
  }

  if (name === 'claim_daily_mission') {
    const today = new Date().toISOString().slice(0, 10);
    if (state.tables.daily_mission_claims.some((c) => c.user_id === userId && c.claim_date === today)) {
      return { data: 0, error: null };
    }
    const reward = 20;
    state.tables.daily_mission_claims.push({ user_id: userId, claim_date: today, coins_awarded: reward });
    const wallet = state.tables.wallets.find((w) => w.user_id === userId);
    if (wallet) {
      wallet.balance += reward;
      wallet.updated_at = new Date().toISOString();
    }
    state.tables.transactions.unshift(makeTransaction('reward', 'Daily mission: watched a rewarded ad', reward));
    return { data: reward, error: null };
  }

  const wallet = () => state.tables.wallets.find((w) => w.user_id === userId)!;
  const subscription = () => state.tables.subscriptions.find((s) => s.user_id === userId)!;
  const paymentsDisabled = { data: null, error: { message: 'payments_disabled' } };
  const adminOnly = { data: null, error: { message: 'admin_only' } };

  if (name === 'simulate_purchase') {
    if (!state.simulatedPayments) return paymentsDisabled;
    const pkg = COIN_PACKAGES.find((p) => p.id === params.p_package_id);
    if (!pkg) return { data: null, error: { message: `package ${params.p_package_id} not found` } };
    wallet().balance += pkg.coins + pkg.bonusCoins;
    state.tables.transactions.unshift(makeTransaction('purchase', `Purchased ${pkg.coins} coins (${pkg.priceLabel})`, pkg.coins + pkg.bonusCoins));
    return { data: wallet().balance, error: null };
  }

  if (name === 'simulate_subscribe') {
    if (!state.simulatedPayments) return paymentsDisabled;
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === params.p_plan_id);
    if (!plan) return { data: null, error: { message: `plan ${params.p_plan_id} not found` } };
    const started = new Date();
    const renews = new Date(started);
    if (plan.id === 'monthly') renews.setMonth(renews.getMonth() + 1);
    else renews.setFullYear(renews.getFullYear() + 1);
    Object.assign(subscription(), { is_active: true, plan_id: plan.id, started_at: started.toISOString(), renews_at: renews.toISOString() });
    if (plan.bonusCoins > 0) {
      wallet().balance += plan.bonusCoins;
      state.tables.transactions.unshift(makeTransaction('bonus', `${plan.title} bonus`, plan.bonusCoins));
    }
    return { data: { ...subscription() }, error: null };
  }

  if (name === 'cancel_subscription') {
    if (!state.simulatedPayments) return paymentsDisabled;
    subscription().is_active = false;
    return { data: { ...subscription() }, error: null };
  }

  if (name === 'reset_my_data') {
    if (!state.simulatedPayments) return paymentsDisabled;
    for (const t of ['favorites', 'unlocks', 'watch_history', 'progress', 'recent_searches', 'transactions', 'daily_mission_claims']) {
      state.tables[t] = state.tables[t].filter((r) => r.user_id !== userId);
    }
    wallet().balance = STARTING_BALANCE;
    Object.assign(subscription(), { is_active: false, plan_id: null, started_at: null, renews_at: null });
    return { data: null, error: null };
  }

  if (name === 'demo_set_balance') {
    if (!state.simulatedPayments) return paymentsDisabled;
    if (!state.isAdmin) return adminOnly;
    const next = params.p_balance as number;
    const old = wallet().balance;
    wallet().balance = next;
    state.tables.transactions.unshift(makeTransaction('reset', `Demo controls: balance set to ${next}`, next - old));
    return { data: next, error: null };
  }

  if (name === 'demo_set_all_unlocked') {
    if (!state.simulatedPayments) return paymentsDisabled;
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

/** Edge Functions (playback-token etc.). Tests set the handler they need. */
type InvokeHandler = (name: string, body: unknown) => Promise<{ data: any; error: any }>;
let invokeHandler: InvokeHandler = async (name) => ({ data: null, error: new Error(`no mock for function ${name}`) });

export function __setInvokeHandler(handler: InvokeHandler) {
  invokeHandler = handler;
}

export const supabase = {
  auth: {
    getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }),
    signOut: async () => {
      state.userId = null;
      return { error: null };
    },
  },
  from: (table: string) => new MockQueryBuilder(table),
  rpc,
  functions: {
    invoke: (name: string, opts?: { body?: unknown }) => invokeHandler(name, opts?.body),
  },
};
