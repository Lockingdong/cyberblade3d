// Friend rooms are joined by typing a code out loud or from a chat message, so
// the alphabet drops the characters people confuse: I, L, O, 0 and 1.
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_PATTERN = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`,
);

/** Uppercases and strips the separators players type or paste (spaces, dashes). */
export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

export function isValidRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value);
}
