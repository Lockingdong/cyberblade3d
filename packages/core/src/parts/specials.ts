export type SpecialMoveId =
  | "blaze_rush"
  | "drake_pierce"
  | "bastion_charge"
  | "genbu_bulwark"
  | "aegis_shockwave"
  | "corona_regen"
  | "falcon_evade"
  | "jade_resonance"
  | "chameleon_mimic";

export interface SpecialMove {
  readonly id: SpecialMoveId;
  readonly name: string;
  readonly englishName: string;
  readonly description: string;
  /** Seconds the effect lasts; instant moves keep a short window for visuals. */
  readonly duration: number;
  /** Steers when the AI fires the move. */
  readonly role: "offense" | "recovery" | "guard" | "mimic";
}

export const SPECIAL_MOVES: Record<SpecialMoveId, SpecialMove> = {
  blaze_rush: {
    id: "blaze_rush",
    name: "烈焰突擊",
    englishName: "Blaze Rush",
    description: "朝對手瞬間衝刺，下一次命中造成 1.8 倍傷害且自身不受傷。",
    duration: 3,
    role: "offense",
  },
  drake_pierce: {
    id: "drake_pierce",
    name: "龍牙破甲",
    englishName: "Drake Pierce",
    description:
      "4 秒內命中無視對手的減傷與玄武不動並提升傷害，對手越硬效果越強。",
    duration: 4,
    role: "offense",
  },
  bastion_charge: {
    id: "bastion_charge",
    name: "磐岩衝鋒",
    englishName: "Bastion Charge",
    description:
      "3 秒內質量加倍、推力提升、受到的碰撞傷害大減，每次命中都把對手往外擊退。",
    duration: 3,
    role: "offense",
  },
  genbu_bulwark: {
    id: "genbu_bulwark",
    name: "玄武不動",
    englishName: "Genbu Bulwark",
    description: "3 秒內不被推動、不損失穩定度，並反彈部分傷害。",
    duration: 3,
    role: "guard",
  },
  aegis_shockwave: {
    id: "aegis_shockwave",
    name: "聖盾震波",
    englishName: "Aegis Shockwave",
    description: "以自身為中心釋放震波，將附近的對手推向場外。",
    duration: 0.6,
    role: "guard",
  },
  corona_regen: {
    id: "corona_regen",
    name: "日冕再生",
    englishName: "Corona Regen",
    description: "立即回復 24% 轉速。",
    duration: 0.8,
    role: "recovery",
  },
  falcon_evade: {
    id: "falcon_evade",
    name: "疾風迴避",
    englishName: "Falcon Evade",
    description:
      "立即回復 17% 轉速，3 秒內碰撞傷害大減、轉速不衰減、移動速度提升。",
    duration: 3,
    role: "guard",
  },
  jade_resonance: {
    id: "jade_resonance",
    name: "翡翠共鳴",
    englishName: "Jade Resonance",
    description: "立即回復 35% 穩定度與 17% 轉速。",
    duration: 0.8,
    role: "recovery",
  },
  chameleon_mimic: {
    id: "chameleon_mimic",
    name: "擬態",
    englishName: "Chameleon Mimic",
    description:
      "4 秒內質量、攻擊倍率與減傷強化 90%，若對手更強則直接複製對手的數值。",
    duration: 4,
    role: "mimic",
  },
};
