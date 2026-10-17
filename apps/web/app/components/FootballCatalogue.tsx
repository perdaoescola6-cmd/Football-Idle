"use client";
import { useState } from "react";
import type { CardEdition } from "../../../../packages/contracts/brasfoot";
import { rarities } from "../../../../packages/contracts/brasfoot";
import { roleNames } from "../../../../packages/contracts/card-model";
import { PlayerPortrait } from "./PlayerDetails";
export default function FootballCatalogue({
  catalog,
  onPlayer,
}: {
  catalog: CardEdition[];
  onPlayer: (c: CardEdition) => void;
}) {
  const [search, setSearch] = useState(""),
    [country, setCountry] = useState(""),
    [club, setClub] = useState(""),
    [rarity, setRarity] = useState(""),
    [role, setRole] = useState(""),
    [limit, setLimit] = useState(48);
  const filtered = catalog.filter(
    (c) =>
      `${c.player} ${c.profile?.fullName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!country || c.profile?.countryCode === country) &&
      (!club || c.profile?.club === club) &&
      (!rarity || c.rarity === rarity) &&
      (!role || c.role === role),
  );
  const countries = [
    ...new Map(
      catalog
        .filter((c) => c.profile)
        .map((c) => [c.profile!.countryCode, c.profile!]),
    ).values(),
  ].sort((a, b) => a.country.localeCompare(b.country));
  const clubs = [
    ...new Set(catalog.map((c) => c.profile?.club).filter(Boolean)),
  ].sort();
  return (
    <>
      <section className="fb-panel">
        <p className="eyebrow">ARQUIVO DO FUTEBOL</p>
        <h2>Catálogo de atletas</h2>
        <p>
          {new Set(catalog.map((c) => c.playerId ?? c.id)).size} jogadores
          distintos · {catalog.length} edições · {countries.length} seleções de
          referência.
        </p>
        <p>
          Base histórica oficial 2022 e seleção brasileira 2024. Os clubes são
          os da fonte histórica; ratings e funções táticas são valores do jogo.
        </p>
        <div className="fb-filters">
          <label>
            Nome ou nome completo
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(48);
              }}
            />
          </label>
          <label>
            Seleção
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Todas</option>
              {countries.map((c) => (
                <option key={c.countryCode} value={c.countryCode}>
                  {c.flag} {c.country}
                </option>
              ))}
            </select>
          </label>
          <label>
            Clube de referência
            <select value={club} onChange={(e) => setClub(e.target.value)}>
              <option value="">Todos</option>
              {clubs.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Raridade
            <select value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="">Todas</option>
              {rarities.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Função tática
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(roleNames).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>{filtered.length} edições encontradas.</p>
      </section>
      <div className="fb-cards">
        {filtered.slice(0, limit).map((c) => (
          <button
            key={c.id}
            className={`fb-card v2-catalog-card rarity-${rarities.indexOf(c.rarity)}`}
            onClick={() => onPlayer(c)}
          >
            <div className="fb-card-top">
              <strong>{c.rating}</strong>
              <span>{c.role ?? c.position}</span>
              <span>{c.rarity}</span>
            </div>
            <PlayerPortrait card={c} />
            <strong>{c.player}</strong>
            <small>
              {c.profile?.flag} {c.profile?.club ?? "Brasil 2024"}
            </small>
            <small>{c.edition}</small>
            <span>Consultar ficha →</span>
          </button>
        ))}
      </div>
      {filtered.length > limit && (
        <button className="v2-more" onClick={() => setLimit(limit + 48)}>
          Mostrar mais 48
        </button>
      )}
    </>
  );
}
