export type User = {
  id: string;
  account: string;
  name: string;
  bio: string;
  birthday: string;
  isAnonymous: boolean;
  hasAvatar: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BirthdayPerson = {
  id: string;
  name: string;
  bio: string;
  isAnonymous: boolean;
  hasAvatar: boolean;
  updatedAt: string;
  hasWished: boolean;
};

export type BlessingKind = "wish" | "cake_share";

export type YearBlessingStat = {
  year: number;
  total: number;
  wishes: number;
  shares: number;
};

export type BlessingStats = {
  total: number;
  wishes: number;
  shares: number;
  years: YearBlessingStat[];
};

export type ApiFieldErrors = Record<string, string>;
