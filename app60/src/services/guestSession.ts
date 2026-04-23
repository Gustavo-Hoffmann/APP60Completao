export type GuestSex = "M" | "F";

export type GuestProfile = {
  age: number;
  sex: GuestSex;
};

let guestMode = false;
let guestProfile: GuestProfile | null = null;

export function setGuestMode(v: boolean) {
  guestMode = v;
  if (!v) guestProfile = null;
}

export function isGuestMode(): boolean {
  return guestMode;
}

export function setGuestProfile(profile: GuestProfile | null) {
  guestProfile = profile;
}

export function getGuestProfile(): GuestProfile | null {
  return guestProfile;
}
