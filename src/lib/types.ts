export type User = {
  id: string;
  account: string;
  email: string | null;
  emailVerifiedAt: string | null;
  uid: string;
  uidChangeCount: number;
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

export type ChangeQuotaState = {
  profile: {
    used: number;
    remaining: number;
    limit: number;
    period: string;
  };
  birthday: {
    used: number;
    remaining: number;
    limit: number;
  };
};

export type ProfileSaveResult = {
  user: User;
  quota: ChangeQuotaState;
  profileChanged: boolean;
  birthdayChanged: boolean;
  removedWishCount: number;
};

export type ApiFieldErrors = Record<string, string>;
