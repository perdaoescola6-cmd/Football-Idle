import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { identity } from "./auth-routes.js";
import { respond } from "./http.js";
import { loadClub, type GameRepository } from "./repository.js";
import { catalog, edition } from "../../../packages/game/card-catalog.js";
import { previewFootball, standings } from "../../../packages/game/brasfoot.js";
import { ensureCareer } from "../../../packages/game/football-career.js";
import { effectiveCard } from "../../../packages/contracts/card-model.js";
import { GameError } from "../../../packages/game/engine.js";
import type {
  FootballState,
  PlayerPerformance,
} from "../../../packages/contracts/brasfoot.js";
import type { ClubRanking } from "../../../packages/contracts/community.js";
export function registerFootballCommunity(
  app: FastifyInstance,
  repo: GameRepository,
) {
  app.get("/v1/brasfoot/catalog", async (request, reply) =>
    respond(request, reply, {
      catalog,
      version: "catalog-v2-fifa2022-br24",
      identities: new Set(catalog.map((c) => c.playerId)).size,
      reference:
        "Histórico 2022 / Brasil 2024. Atributos são balanceamento do jogo.",
    }),
  );
  app.get("/v1/brasfoot/preview", async (request, reply) => {
    const auth = (await identity(repo, request))!;
    const view = await repo.db.transaction(async (tx) => {
      const s = await loadClub(tx, auth.accountId, false, repo.clock());
      if (!s)
        throw new GameError("CLUB_NOT_FOUND", "Clube não encontrado.", 404);
      return previewFootball(s);
    });
    return respond(request, reply, view);
  });
  app.get("/v1/brasfoot/rankings", async (request, reply) => {
    await identity(repo, request);
    const query = z
      .object({
        scope: z.enum(["global", "division", "season"]).default("global"),
        division: z.coerce.number().int().min(0).max(3).optional(),
        season: z.coerce.number().int().positive().optional(),
      })
      .parse(request.query);
    const rows = (
      await repo.db.query<{ id: string; name: string; f: FootballState }>(
        "SELECT id,name,runtime->'brasfoot' f FROM clubs WHERE runtime ? 'brasfoot'",
      )
    ).rows;
    const clubs: ClubRanking[] = [],
      performances = new Map<string, PlayerPerformance>();
    for (const row of rows) {
      const f = row.f;
      ensureCareer(f, row.id);
      if (
        query.scope === "division" &&
        f.season.division !== (query.division ?? 0)
      )
        continue;
      const rankingSeason =
        query.scope === "season" &&
        query.season &&
        f.season.number !== query.season
          ? f.seasons.find((s) => s.number === query.season)
          : f.season;
      if (!rankingSeason) continue;
      const own = rankingSeason.table?.find((t) => t.id === row.id);
      // Older archives can lack standings; never substitute today's table.
      if (own)
        clubs.push({
          id: row.id,
          name: row.name,
          division: rankingSeason.division,
          season: rankingSeason.number,
          seasonPoints: own.points,
          seasonRecord: own,
          position:
            "position" in rankingSeason
              ? rankingSeason.position
              : standings(rankingSeason).findIndex((t) => t.id === row.id) + 1,
          career: f.careerV2!,
        });
      for (const original of Object.values(f.performance ?? {})) {
        const p = structuredClone(original);
        if (query.scope === "season") {
          const stats = p.seasons[String(rankingSeason.number)];
          if (!stats) continue;
          for (const field of [
            "appearances",
            "minutes",
            "goals",
            "assists",
            "cleanSheets",
            "saves",
            "passes",
            "shots",
            "ratingTotal",
            "ratedMatches",
          ] as const)
            p[field] = stats[field] ?? 0;
        }
        const existing = performances.get(p.playerId);
        if (!existing) {
          performances.set(p.playerId, structuredClone(p));
          continue;
        }
        for (const field of [
          "appearances",
          "minutes",
          "goals",
          "assists",
          "cleanSheets",
          "saves",
          "passes",
          "shots",
          "ratingTotal",
          "ratedMatches",
        ] as const)
          existing[field] += p[field];
      }
    }
    clubs.sort(
      (a, b) =>
        (query.scope === "season"
          ? b.seasonPoints - a.seasonPoints ||
            b.seasonRecord.wins - a.seasonRecord.wins ||
            b.seasonRecord.gf -
              b.seasonRecord.ga -
              (a.seasonRecord.gf - a.seasonRecord.ga) ||
            b.seasonRecord.gf - a.seasonRecord.gf
          : b.career.points - a.career.points ||
            b.career.wins - a.career.wins ||
            b.career.gf - b.career.ga - (a.career.gf - a.career.ga) ||
            b.career.gf - a.career.gf) || a.id.localeCompare(b.id),
    );
    return respond(request, reply, {
      scope: query.scope,
      clubs,
      players: [...performances.values()],
      quality: [...catalog].sort(
        (a, b) => b.rating - a.rating || a.id.localeCompare(b.id),
      ),
    });
  });
  app.get("/v1/brasfoot/clubs/:id", async (request, reply) => {
    await identity(repo, request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const row = (
      await repo.db.query<{ id: string; name: string; f: FootballState }>(
        "SELECT id,name,runtime->'brasfoot' f FROM clubs WHERE id=$1 AND runtime ? 'brasfoot'",
        [id],
      )
    ).rows[0];
    if (!row)
      throw new GameError("CLUB_NOT_FOUND", "Clube não encontrado.", 404);
    const f = row.f;
    ensureCareer(f, id);
    return respond(request, reply, {
      id,
      name: row.name,
      division: f.season.division,
      season: f.season.number,
      career: f.careerV2,
      roster: f.cards.map((card) => ({
        card,
        edition: effectiveCard(edition(card.editionId), card),
        starter: f.lineup.includes(card.id),
      })),
      results: f.history,
      seasons: f.seasons,
    });
  });
}
