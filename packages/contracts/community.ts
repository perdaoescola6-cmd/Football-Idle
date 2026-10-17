import type {
  CardEdition,
  OwnedCard,
  PlayerPerformance,
  FootballState,
  Standing,
} from "./brasfoot.js";
export interface CardListing {
  id: string;
  sellerId: string;
  sellerName: string;
  card: OwnedCard;
  editionId: string;
  price: string;
  status: string;
  createdAt: number;
  buyerId?: string;
}
export interface ClubRanking {
  id: string;
  name: string;
  division: number;
  season: number;
  seasonPoints: number;
  seasonRecord: Standing;
  position: number;
  career: NonNullable<FootballState["careerV2"]>;
}
export interface RankingView {
  clubs: ClubRanking[];
  players: PlayerPerformance[];
  quality: CardEdition[];
  scope: string;
}
export interface ClubPublicView {
  id: string;
  name: string;
  division: number;
  season: number;
  career: NonNullable<FootballState["careerV2"]>;
  roster: { card: OwnedCard; edition: CardEdition; starter: boolean }[];
  results: FootballState["history"];
  seasons: FootballState["seasons"];
}
