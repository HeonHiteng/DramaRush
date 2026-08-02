/**
 * A tiny in-memory stand-in for @supabase/supabase-js, just enough to
 * exercise the store logic in src/store/*.ts (which are otherwise thin
 * wrappers around supabase.from()/rpc() calls). The unlock_episode_with_coins
 * and redeem_ad_reward RPCs are re-implemented here in JS to mirror the real
 * SQL functions (see DramaRush-Backend's 20260802000004_functions.sql) so
 * the store-level "no double charge" / "insufficient coins" guarantees stay
 * covered by fast, offline unit tests. The SQL itself is reviewed separately
 * — this does not replace testing against a real Postgres instance.
 */

type Row = Record<string, any>;

interface State {
  userId: string | null;
  tables: Record<string, Row[]>;
}

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
    episodes: [
      { id: 'ep-coin', series_id: 'series-1', number: 1, title: 'Coin Episode', access: 'coin', coin_price: 20 },
      { id: 'ep-ad', series_id: 'series-1', number: 2, title: 'Ad Episode', access: 'ad_unlock', coin_price: null },
      { id: 'ep-free', series_id: 'series-1', number: 3, title: 'Free Episode', access: 'free', coin_price: null },
    ],
    series: [{ id: 'series-1', title: 'Test Series' }],
  };
}

const state: State = { userId: TEST_USER_ID, tables: defaultTables() };

export function __reset() {
  state.userId = TEST_USER_ID;
  state.tables = defaultTables();
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
    state.tables.unlocks.push({ user_id: userId, episode_id: episodeId });
    state.tables.transactions.unshift(makeTransaction('reward', 'Unlocked via rewarded ad', 0));
    return { data: true, error: null };
  }

  return { data: null, error: { message: `unknown rpc ${name}` } };
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
};
