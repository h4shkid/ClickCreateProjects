export interface SeasonGroup {
  name: string;
  displayName: string;
  tokenIds: string[];
  description?: string;
}

// Based on actual Season trait in NFT metadata
// Season 1: 50 NFTs (tokens 2-51)
// Season 2: 39 NFTs (tokens 53-91)
// Season 3: 5 NFTs (tokens 92-96)
export const SEASON_GROUPS: SeasonGroup[] = [
  {
    name: 'season1',
    displayName: 'Season 1',
    tokenIds: ['2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51'],
    description: 'Season 1 artworks (50 NFTs)'
  },
  {
    name: 'season2',
    displayName: 'Season 2',
    tokenIds: ['53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91'],
    description: 'Season 2 artworks (39 NFTs)'
  },
  {
    name: 'season3',
    displayName: 'Season 3',
    tokenIds: ['92','93','94','95','96'],
    description: 'Season 3 artworks (5 NFTs)'
  },
  {
    name: 'all_seasons',
    displayName: 'All Seasons',
    tokenIds: ['2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73','74','75','76','77','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','96'],
    description: 'All season artworks (94 NFTs)'
  },
  {
    name: 'subpasses',
    displayName: 'SubPasses Only',
    tokenIds: ['1', '52'],
    description: 'Genesis and Season 2 SubPass tokens'
  },
  {
    name: 'all_collection',
    displayName: 'Entire Collection',
    tokenIds: Array.from({ length: 96 }, (_, i) => String(i + 1)),
    description: 'All tokens including SubPasses (96 NFTs)'
  }
];

export function getSeasonGroup(name: string): SeasonGroup | undefined {
  return SEASON_GROUPS.find(group => group.name === name);
}

export function formatTokenIdsForInput(tokenIds: string[]): string {
  return tokenIds.join(',');
}