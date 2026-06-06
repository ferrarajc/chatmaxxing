export interface PodcastEpisode {
  number: number;
  title: string;
  description: string;
  filename: string;
}

export const BOB_POD_EPISODES: PodcastEpisode[] = [
  {
    number: 3,
    title: 'Episode 3',
    description: 'The latest episode of The Bob Pod.',
    filename: 'Bob_Pod_Episode_3.m4a',
  },
  {
    number: 2,
    title: 'Episode 2',
    description: 'The Bob Pod, Episode 2.',
    filename: 'Bob_Pod_Episode_2.m4a',
  },
  {
    number: 1,
    title: 'From Zero to Fully Invested',
    description: 'Investing basics for financial newbies — from knowing nothing about markets to understanding what it takes to become a confident long-term investor.',
    filename: 'From_zero_to_fully_invested.m4a',
  },
];
