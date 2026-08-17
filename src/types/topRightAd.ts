export interface TopRightAd {
  id: string;
  enabled: boolean;
  relayRelated: boolean;
  priority: number;
  text: string;
  badge?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  displayMode?: string | null;
  displayPages?: string[] | null;
  displayPlatforms?: string[] | null;
  excludePages?: string[] | null;
  excludePlatforms?: string[] | null;
  targetVersions: string;
  targetLanguages?: string[];
  createdAt: string;
  expiresAt?: string | null;
}

export interface TopRightAdState {
  ad: TopRightAd | null;
  ads: TopRightAd[];
}
