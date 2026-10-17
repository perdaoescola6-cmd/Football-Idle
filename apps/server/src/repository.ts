import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  GameView,
  LedgerEntry,
  MatchView,
} from "../../../packages/contracts/index.js";
import {
  advance,
  GameError,
  type Runtime,
  type Settlement,
  type State,
  offlineView,
} from "../../../packages/game/engine.js";
import { derivedId, deriveSeed } from "../../../packages/game/random.js";
import { RULES_VERSION } from "../../../packages/game/rules.js";
import { gameTime } from "../../../packages/game/test-clock.js";
import type { Database, Sql } from "./db.js";
import { gameplay, trainTick } from "../../../packages/game/gameplay.js";
import { identify } from "../../../packages/game/identity.js";
import { liveMatch } from "../../../packages/game/simulation.js";
import { regions } from "../../../packages/contracts/world.js";
import type { MarketListing } from "../../../packages/contracts/index.js";
import {
  settleFootball,
  footballView,
} from "../../../packages/game/brasfoot.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function loadClub(
  tx: Sql,
  accountId: string,
  lock = false,
  realNow = Date.now(),
): Promise<State | null> {
  const row = (
    await tx.query<{ id: string; name: string; runtime: Runtime }>(
      "SELECT id,name,runtime FROM clubs WHERE account_id=$1" +
        (lock ? " FOR UPDATE" : ""),
      [accountId],
    )
  ).rows[0];
  if (!row) return null;
  const wallet = (
    await tx.query<{ balance: string; version: string; total: string }>(
      `SELECT w.balance::text,w.version::text,
    (SELECT coalesce(sum(l.delta),0)::text FROM coin_ledger_entries l WHERE l.club_id=w.club_id) AS total
    FROM wallets w WHERE w.club_id=$1`,
      [row.id],
    )
  ).rows[0];
  if (
    !wallet ||
    wallet.balance !== row.runtime.balance ||
    wallet.total !== wallet.balance ||
    Number(wallet.version) !== row.runtime.walletVersion
  )
    throw new GameError(
      "ECONOMY_INTEGRITY_ERROR",
      "A carteira precisa de verificação. Novas operações foram interrompidas.",
      503,
    );
  const athletes = (
    await tx.query<{ body: State["athletes"][number] }>(
      "SELECT body FROM athletes WHERE club_id=$1 AND active=true ORDER BY id",
      [row.id],
    )
  ).rows.map((a, i) =>
    identify(
      a.body,
      row.runtime.lineup.indexOf(a.body.id) >= 0
        ? row.runtime.lineup.indexOf(a.body.id)
        : i,
    ),
  );
  if (!row.runtime.career) {
    const c = (
      await tx.query<{
        matches: string;
        wins: string;
        draws: string;
        losses: string;
        goals: string;
        coins: string;
        drops: string;
      }>(
        `SELECT count(*)::text matches,count(*) FILTER(WHERE body->'result'->>'outcome'='WIN')::text wins,count(*) FILTER(WHERE body->'result'->>'outcome'='DRAW')::text draws,count(*) FILTER(WHERE body->'result'->>'outcome'='LOSS')::text losses,coalesce(sum((body->'result'->>'homeGoals')::numeric),0)::text goals,coalesce(sum((body->'reward'->>'coins')::numeric),0)::text coins,count(*) FILTER(WHERE body->'reward'->'athlete'<>'null'::jsonb)::text drops FROM matches WHERE club_id=$1 AND state='SETTLED'`,
        [row.id],
      )
    ).rows[0];
    row.runtime.career = c;
  }
  const current = (
    await tx.query<{ body: MatchView; seed: string }>(
      "SELECT body,seed FROM matches WHERE club_id=$1 AND state='RUNNING'",
      [row.id],
    )
  ).rows[0];
  return {
    id: row.id,
    name: row.name,
    runtime: row.runtime,
    athletes,
    reservedCoins: (
      await tx.query<{ amount: string }>(
        "SELECT coalesce(sum(h.amount),0)::text amount FROM coin_holds h JOIN market_listings l ON l.id=h.listing_id WHERE h.club_id=$1 AND h.active AND h.expires_at>$2 AND l.status='OPEN' AND l.expires_at>$2",
        [row.id, realNow],
      )
    ).rows[0].amount,
    lockedAthletes: (
      await tx.query<{ athlete_id: string }>(
        "SELECT athlete_id FROM market_listings WHERE seller_id=$1 AND status='OPEN' AND expires_at>$2",
        [row.id, realNow],
      )
    ).rows.map((r) => r.athlete_id),
    current: current ? { view: current.body, seed: current.seed } : null,
  };
}
async function saveMatch(tx: Sql, clubId: string, m: MatchView, seed: string) {
  await tx.query(
    `INSERT INTO matches(id,club_id,sequence,state,start_at,end_at,seed,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state,body=EXCLUDED.body WHERE matches.state='RUNNING'`,
    [
      m.id,
      clubId,
      m.sequence,
      m.state,
      m.startAt,
      m.endAt,
      seed,
      JSON.stringify(m),
    ],
  );
}
async function grant(
  tx: Sql,
  s: State,
  m: MatchView,
  kind: string,
  target: string,
  amount: string,
  payload: unknown,
) {
  const id = `${m.id}:${kind}:${target}`;
  await tx.query(
    "INSERT INTO reward_grants(id,club_id,match_id,kind,target_key,amount,payload) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      id,
      s.id,
      m.id,
      kind,
      target,
      amount,
      JSON.stringify({
        ...(payload as Record<string, unknown>),
        testRun: m.testRun ?? false,
      }),
    ],
  );
  return id;
}
export async function saveClub(
  tx: Sql,
  s: State,
  settlements: Settlement[],
  now: number,
) {
  for (const item of settlements) {
    const m = item.match,
      r = m.reward!;
    await saveMatch(
      tx,
      s.id,
      m,
      deriveSeed(s.runtime.secret, `match:${m.sequence}`),
    );
    await grant(tx, s, m, "COINS", "club", r.coins, {
      onlineMs: r.onlineMs,
      offlineMs: r.offlineMs,
    });
    await grant(tx, s, m, "CLUB_XP", "club", r.clubXp, {});
    for (const xp of r.athleteXp)
      await grant(tx, s, m, "ATHLETE_XP", xp.athleteId, xp.amount, {});
    if (BigInt(r.coins) > 0n)
      await tx.query(
        "INSERT INTO coin_ledger_entries(id,club_id,match_id,delta,balance_after,wallet_version,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          derivedId(m.id, "ledger"),
          s.id,
          m.id,
          r.coins,
          item.balanceAfter,
          item.walletVersion,
          m.endAt,
        ],
      );
    if (r.material) {
      const id = await grant(
        tx,
        s,
        m,
        "MATERIAL",
        "common_supply",
        String(r.material),
        {},
      );
      await tx.query(
        "INSERT INTO inventory_movements(grant_id,club_id,material_id,delta) VALUES($1,$2,$3,$4)",
        [id, s.id, "common_supply", r.material],
      );
    }
    if (r.athlete)
      await grant(tx, s, m, "ATHLETE_DROP", r.athlete.id, "1", {
        rarity: r.athlete.rarity,
      });
  }
  if (s.current) await saveMatch(tx, s.id, s.current.view, s.current.seed);
  await tx.query(
    `INSERT INTO athletes(id,club_id,rarity,xp_total,level,ovr,body)
 SELECT (a->>'id')::uuid,$1,a->>'rarity',(a->>'xpTotal')::numeric,(a->>'level')::numeric,(a->>'ovr')::integer,a
 FROM jsonb_array_elements($2::jsonb) a
 ON CONFLICT(id) DO UPDATE SET xp_total=EXCLUDED.xp_total,level=EXCLUDED.level,ovr=EXCLUDED.ovr,body=EXCLUDED.body,updated_at=now()
 WHERE athletes.body IS DISTINCT FROM EXCLUDED.body`,
    [s.id, JSON.stringify(s.athletes)],
  );
  await tx.query("DELETE FROM lineup_slots WHERE club_id=$1", [s.id]);
  for (let i = 0; i < s.runtime.lineup.length; i++)
    await tx.query(
      "INSERT INTO lineup_slots(club_id,slot,athlete_id) VALUES($1,$2,$3)",
      [s.id, i + 1, s.runtime.lineup[i]],
    );
  await tx.query(
    "UPDATE athletes SET active=false,updated_at=now() WHERE club_id=$1 AND active=true AND NOT(id=ANY($2::uuid[]))",
    [s.id, s.athletes.map((a) => a.id)],
  );
  for (const e of s.journal ?? []) {
    await tx.query(
      "INSERT INTO coin_ledger_entries(id,club_id,match_id,delta,balance_after,wallet_version,created_at,reason) VALUES($1,$2,NULL,$3,$4,$5,$6,$7)",
      [e.id, s.id, e.delta, e.balanceAfter, e.version, e.at, e.reason],
    );
    if (e.reason.startsWith("BR_OFFICIAL_MATCH:")) {
      const match = s.runtime.brasfoot?.history.find(
        (m) => e.reason === `BR_OFFICIAL_MATCH:${m.id}`,
      );
      await tx.query(
        "INSERT INTO football_audit(id,club_id,created_at,action,payload) VALUES($1,$2,$3,$4,$5)",
        [
          e.id,
          s.id,
          e.at,
          "MATCH_SETTLED",
          JSON.stringify({ match, walletVersion: e.version, delta: e.delta }),
        ],
      );
    }
  }
  s.journal = [];
  for (const e of s.materialJournal ?? [])
    await tx.query(
      "INSERT INTO inventory_adjustments(id,club_id,material_id,delta,reason,created_at) VALUES($1,$2,'common_supply',$3,$4,$5)",
      [e.id, s.id, e.delta, e.reason, e.at],
    );
  s.materialJournal = [];
  await tx.query(
    "INSERT INTO wallets(club_id,balance,version) VALUES($1,$2,$3) ON CONFLICT(club_id) DO UPDATE SET balance=EXCLUDED.balance,version=EXCLUDED.version",
    [s.id, s.runtime.balance, s.runtime.walletVersion],
  );
  await tx.query(
    "INSERT INTO inventory_balances(club_id,material_id,quantity) VALUES($1,$2,$3) ON CONFLICT(club_id,material_id) DO UPDATE SET quantity=EXCLUDED.quantity",
    [s.id, "common_supply", s.runtime.commonSupply],
  );
  for (const region of regions
    .filter((r) => BigInt(r.level) <= 1n + BigInt(s.runtime.clubXp) / 100n)
    .map((r) => r.id))
    await tx.query(
      "INSERT INTO club_region_unlocks(club_id,region_id,unlocked_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [s.id, region, now],
    );
  await tx.query(
    "UPDATE clubs SET runtime=$2,version=version+1,updated_at=now() WHERE id=$1",
    [s.id, JSON.stringify(s.runtime)],
  );
}
export async function gameView(
  tx: Sql,
  s: State,
  now: number,
  pending = false,
  realNow = Date.now(),
  omitRoster = false,
): Promise<GameView> {
  const recent = (
    await tx.query<{ body: MatchView }>(
      "SELECT body FROM matches WHERE club_id=$1 AND state='SETTLED' ORDER BY sequence DESC LIMIT 10",
      [s.id],
    )
  ).rows.map((r) => liveMatch(r.body, "", now));
  const rows = (
    await tx.query<{
      id: string;
      match_id: string;
      delta: string;
      balance_after: string;
      wallet_version: string;
      created_at: string;
      reason: string;
    }>(
      "SELECT * FROM coin_ledger_entries WHERE club_id=$1 ORDER BY wallet_version DESC LIMIT 20",
      [s.id],
    )
  ).rows;
  const ledger: LedgerEntry[] = rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    delta: String(r.delta),
    balanceAfter: String(r.balance_after),
    version: Number(r.wallet_version),
    createdAt: Number(r.created_at),
    reason: r.reason,
  }));
  const offline = offlineView(s, now, pending);
  const transfers = (
    await tx.query<{
      listing_id: string;
      athlete_name: string;
      total: string;
      commission: string;
      buyer_name: string;
      seller_name: string;
      created_at: string;
      buyer_id: string;
    }>(
      `SELECT t.listing_id,l.body->'athlete'->>'displayName' athlete_name,t.total::text,t.commission::text,b.name buyer_name,v.name seller_name,t.created_at::text,t.buyer_id FROM market_transfers t JOIN market_listings l ON l.id=t.listing_id JOIN clubs b ON b.id=t.buyer_id JOIN clubs v ON v.id=t.seller_id WHERE t.buyer_id=$1 OR t.seller_id=$1 ORDER BY t.created_at DESC LIMIT 50`,
      [s.id],
    )
  ).rows;
  const marketRecords = (
    await tx.query<{ body: MarketListing }>(
      `SELECT body FROM market_listings WHERE status<>'OPEN' AND (seller_id=$1 OR EXISTS(SELECT 1 FROM jsonb_array_elements(body->'offers') o WHERE o->>'buyerId'=$2)) ORDER BY expires_at DESC LIMIT 50`,
      [s.id, s.id],
    )
  ).rows.map((r) => r.body);
  const publicGameplay = structuredClone(gameplay(s));
  if (publicGameplay.scout) delete publicGameplay.scout.athlete;
  const market = (
    await tx.query<{ body: MarketListing }>(
      "SELECT body FROM market_listings WHERE status='OPEN' AND expires_at>$1 ORDER BY expires_at LIMIT 100",
      [realNow],
    )
  ).rows.map((r) => r.body);
  return {
    brasfoot: footballView(s, now, false),
    revision: (
      await tx.query<{ version: string }>(
        "SELECT version::text FROM clubs WHERE id=$1",
        [s.id],
      )
    ).rows[0].version,
    gameplay: publicGameplay,
    marketRecords,
    marketHistory: transfers.map((t) => ({
      listingId: t.listing_id,
      athleteName: t.athlete_name,
      total: t.total,
      commission: t.commission,
      buyerName: t.buyer_name,
      sellerName: t.seller_name,
      createdAt: Number(t.created_at),
      direction: t.buyer_id === s.id ? "BUY" : "SELL",
    })),
    market,
    testMode: {
      speed: s.runtime.testClock?.speed ?? 1,
      used: s.runtime.testClock?.used ?? false,
    },
    club: {
      id: s.id,
      name: s.name,
      xpTotal: s.runtime.clubXp,
      level: (1n + BigInt(s.runtime.clubXp) / 100n).toString(),
      regionalUnlocked: s.runtime.regionalUnlocked,
    },
    wallet: {
      balance: s.runtime.balance,
      version: s.runtime.walletVersion,
      reserved: s.reservedCoins ?? "0",
      available: String(
        BigInt(s.runtime.balance) - BigInt(s.reservedCoins ?? "0"),
      ),
    },
    athletes: omitRoster ? [] : s.athletes,
    rosterOmitted: omitRoster,
    rosterRevision: (
      await tx.query<{ revision: string }>(
        "SELECT coalesce(max(updated_at)::text,'0')||':'||count(*) FILTER(WHERE active)::text revision FROM athletes WHERE club_id=$1",
        [s.id],
      )
    ).rows[0].revision,
    career: s.runtime.career,
    lineup: { athleteIds: s.runtime.lineup, version: s.runtime.lineupVersion },
    inventory: { commonSupply: s.runtime.commonSupply },
    farm: {
      running: s.runtime.farm.running,
      regionId: s.runtime.farm.region,
      version: s.runtime.farm.version,
      status: !s.runtime.farm.running
        ? "STOPPED"
        : s.current || offline.online
          ? "READY"
          : "OFFLINE_EXHAUSTED",
    },
    currentMatch: s.current
      ? liveMatch(s.current.view, s.current.seed, now)
      : null,
    recentMatches: recent,
    ledger,
    offline,
    serverTime: now,
    rulesVersion: RULES_VERSION,
  };
}
export class GameRepository {
  constructor(
    public db: Database,
    public clock = Date.now,
  ) {}
  gameTime(s: State) {
    if (s.runtime.brasfoot) return this.clock();
    return gameTime(s, this.clock());
  }
  async match(accountId: string, id: string): Promise<MatchView> {
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM economy_mutex WHERE id=1 FOR UPDATE");
      const s = await loadClub(tx, accountId, true, this.clock());
      if (!s)
        throw new GameError(
          "RESOURCE_NOT_FOUND",
          "Partida não encontrada.",
          404,
        );
      const row = (
        await tx.query<{ body: MatchView; seed: string }>(
          "SELECT body,seed FROM matches WHERE id=$1 AND club_id=$2",
          [id, s.id],
        )
      ).rows[0];
      if (!row)
        throw new GameError(
          "RESOURCE_NOT_FOUND",
          "Partida não encontrada.",
          404,
        );
      return liveMatch(row.body, row.seed, this.gameTime(s));
    });
  }
  async mutate<T>(
    accountId: string,
    operation: string,
    key: string,
    body: unknown,
    run: (s: State, tx: Sql) => Promise<T> | T,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM economy_mutex WHERE id=1 FOR UPDATE");
      // Account lock also serializes first-club creation and idempotency checks.
      await tx.query("SELECT id FROM accounts WHERE id=$1 FOR UPDATE", [
        accountId,
      ]);
      const digest = hash(canonical(body));
      const previous = (
        await tx.query<{ request_hash: string; response: T }>(
          "SELECT request_hash,response FROM idempotency_records WHERE account_id=$1 AND operation=$2 AND key=$3",
          [accountId, operation, key],
        )
      ).rows[0];
      if (previous) {
        if (previous.request_hash !== digest)
          throw new GameError(
            "IDEMPOTENCY_KEY_REUSED",
            "A chave desta ação já foi usada com outros dados.",
            409,
          );
        return previous.response;
      }
      const s = await loadClub(tx, accountId, true, this.clock());
      if (!s)
        throw new GameError("CLUB_NOT_FOUND", "Crie seu clube primeiro.", 404);
      if (
        s.runtime.brasfoot &&
        !operation.startsWith("brasfoot.") &&
        !operation.startsWith("presence") &&
        operation !== "offline.reconcile"
      )
        throw new GameError(
          "LEGACY_DISABLED",
          "Este clube usa o modo 11v11; ações da economia antiga estão arquivadas.",
          409,
        );
      const now = this.gameTime(s),
        progress = advance(s, now);
      settleFootball(s, now);
      if (
        progress.pending &&
        !operation.startsWith("presence") &&
        operation !== "offline.reconcile"
      )
        throw new GameError(
          "HISTORY_RECONCILIATION_REQUIRED",
          "Seu histórico está sendo processado. Aguarde alguns instantes.",
          409,
        );
      await saveClub(tx, s, progress.settlements, now);
      trainTick(s, now);
      const response = await run(s, tx);
      await saveClub(tx, s, [], now);
      await tx.query(
        "INSERT INTO idempotency_records(account_id,operation,key,request_hash,response) VALUES($1,$2,$3,$4,$5)",
        [accountId, operation, key, digest, JSON.stringify(response)],
      );
      return response;
    });
  }
  async view(accountId: string, reconcile = false, omitRoster = false) {
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM economy_mutex WHERE id=1 FOR UPDATE");
      const s = await loadClub(tx, accountId, true, this.clock());
      if (!s) return null;
      const now = this.gameTime(s);
      if (reconcile) {
        const progress = advance(s, now);
        settleFootball(s, now);
        await saveClub(tx, s, progress.settlements, now);
        trainTick(s, now);
        await saveClub(tx, s, [], now);
        return gameView(tx, s, now, progress.pending, this.clock(), omitRoster);
      }
      const pending = Boolean(
        s.current && s.current.view.endAt + 32 * 90000 <= now,
      );
      return gameView(tx, s, now, pending, this.clock(), omitRoster);
    });
  }
  async tick() {
    const accounts = (
      await this.db.query<{ account_id: string }>(
        "SELECT account_id FROM clubs WHERE runtime->'farm'->>'running'='true' OR (runtime->'brasfoot'->>'match') IS NOT NULL OR jsonb_array_length(coalesce(runtime->'gameplay'->'training','[]'::jsonb))>0 OR EXISTS(SELECT 1 FROM matches WHERE matches.club_id=clubs.id AND state='RUNNING')",
      )
    ).rows;
    for (const row of accounts) await this.view(row.account_id, true);
  }
  async guest(existingAccount?: string) {
    if (existingAccount) return { accountId: existingAccount, token: null };
    const accountId = randomUUID(),
      token = randomBytes(32).toString("hex");
    await this.db.transaction(async (tx) => {
      await tx.query("INSERT INTO accounts(id) VALUES($1)", [accountId]);
      await tx.query(
        "INSERT INTO auth_sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)",
        [hash(token), accountId, this.clock() + 30 * 86400000],
      );
    });
    return { accountId, token };
  }
}
