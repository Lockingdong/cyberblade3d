import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, {
  Defs,
  Line,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import {
  border,
  gradients,
  palette,
  radius,
  shadow,
  skew,
  spacing,
} from "@cyberblade/design-system";

/**
 * The primitives the print look is built from. Screens compose these rather
 * than re-deriving borders and shadows, so the two apps cannot drift apart one
 * `StyleSheet.create` at a time.
 */

const GRID_CELL = 32;

/**
 * The page background: paper, a faint cyan graph grid, and two off-centre
 * glows. Drawn as one SVG because a grid built from Views would be hundreds of
 * nodes for something that never changes.
 */
export function PaperBackdrop(): React.JSX.Element {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="grid"
            width={GRID_CELL}
            height={GRID_CELL}
            patternUnits="userSpaceOnUse"
          >
            <Line
              x1="0"
              y1="0"
              x2={GRID_CELL}
              y2="0"
              stroke={palette.cyan}
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <Line
              x1="0"
              y1="0"
              x2="0"
              y2={GRID_CELL}
              stroke={palette.cyan}
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          </Pattern>
          <RadialGradient id="glowCyan" cx="15%" cy="85%" r="70%">
            <Stop offset="0" stopColor={palette.cyan} stopOpacity={0.22} />
            <Stop offset="1" stopColor={palette.cyan} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowPurple" cx="88%" cy="12%" r="60%">
            <Stop offset="0" stopColor={palette.purple} stopOpacity={0.18} />
            <Stop offset="1" stopColor={palette.purple} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={palette.paper} />
        <Rect width="100%" height="100%" fill="url(#grid)" />
        <Rect width="100%" height="100%" fill="url(#glowCyan)" />
        <Rect width="100%" height="100%" fill="url(#glowPurple)" />
      </Svg>
    </View>
  );
}

type HardShadow = { dx: number; dy: number; color: string };

/**
 * The offset shadow, drawn as a solid sibling rather than a platform shadow.
 * `shadowRadius: 0` gets close on iOS but Android's `elevation` always blurs,
 * and a blurred edge reads as depth instead of ink.
 *
 * The translation is listed before the skew so the offset stays in screen
 * space; skewing first would drag the shadow sideways as the card leans.
 */
function ShadowLayer({
  offset,
  cornerRadius,
  skewX,
}: {
  offset: HardShadow;
  cornerRadius: number;
  skewX?: string | undefined;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.fill,
        {
          backgroundColor: offset.color,
          borderRadius: cornerRadius,
          transform: [
            { translateX: offset.dx },
            { translateY: offset.dy },
            ...(skewX ? [{ skewX }] : []),
          ],
        },
      ]}
    />
  );
}

/**
 * A white card with an ink outline and an offset shadow. `lean` adds the skew
 * that the blade cards use; the children are counter-skewed so text stays
 * upright.
 */
export function InkCard({
  children,
  style,
  contentStyle,
  accent,
  active = false,
  lean = false,
  lifted = false,
  offset = shadow.hard,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Border colour when `active` — the blade's own colour, normally. */
  accent?: string | undefined;
  active?: boolean;
  lean?: boolean;
  lifted?: boolean;
  offset?: HardShadow;
}): React.JSX.Element {
  const cardShadow = lifted || active ? shadow.hardLifted : offset;
  const skewX = lean ? skew.card : undefined;
  return (
    <View style={[styles.cardOuter, style]}>
      <ShadowLayer
        offset={cardShadow}
        cornerRadius={radius.md}
        {...(skewX ? { skewX } : {})}
      />
      <View
        style={[
          styles.card,
          active && accent ? { borderColor: accent } : null,
          skewX ? { transform: [{ skewX }] } : null,
        ]}
      >
        <View
          style={[
            lean ? { transform: [{ skewX: skew.cardContent }] } : null,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

/**
 * A panel: same ink treatment as a card but translucent white and never
 * leaning, used to group a screen's content.
 */
export function InkPanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.cardOuter, style]}>
      <ShadowLayer offset={shadow.hardPanel} cornerRadius={radius.lg} />
      <View style={styles.panel}>{children}</View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonOuter,
        disabled && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <LinearGradient
        colors={[...gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryFill}
      >
        <Text style={styles.primaryLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** The secondary action: white fill, ink outline, skewed like the web button. */
export function InkButton({
  label,
  onPress,
  disabled = false,
  tone = "default",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "default" | "accent";
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonOuter,
        disabled && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      <View style={styles.inkButtonBox}>
        <ShadowLayer offset={shadow.soft} cornerRadius={radius.md} />
        <View
          style={[
            styles.inkButtonFill,
            tone === "accent" ? { borderColor: palette.cyan } : null,
          ]}
        >
          <Text
            style={[
              styles.inkButtonLabel,
              tone === "accent" ? { color: palette.cyan } : null,
            ]}
          >
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function Eyebrow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}): React.JSX.Element {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

/**
 * The wordmark. The web version stacks five text-shadows; React Native allows
 * one, so the paper-coloured outline is the shadow and the cyan offset copy is
 * a second Text rendered behind.
 */
export function LogoTitle({ text }: { text: string }): React.JSX.Element {
  return (
    <View style={styles.logoBox}>
      <Text
        style={[styles.logo, styles.logoShadow]}
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {text}
      </Text>
      <Text
        style={styles.logo}
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {text}
      </Text>
    </View>
  );
}

export function StatBar({
  ratio,
  style,
}: {
  ratio: number;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={[styles.statTrack, style]}>
      <LinearGradient
        colors={[...gradients.stat]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${clamped * 100}%`, height: "100%" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  cardOuter: { position: "relative" },
  card: {
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    padding: spacing.md,
  },
  panel: {
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    padding: spacing.md,
  },
  buttonOuter: { width: "100%" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  primaryFill: {
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderRadius: radius.lg,
  },
  primaryLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  inkButtonBox: { position: "relative" },
  inkButtonFill: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  inkButtonLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  eyebrow: {
    color: palette.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3,
  },
  logoBox: { width: "100%" },
  logo: {
    color: palette.ink,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -1,
    textAlign: "center",
    textShadowColor: palette.paper,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 1,
  },
  logoShadow: {
    position: "absolute",
    left: -6,
    top: 6,
    right: 0,
    color: palette.cyan,
    textShadowRadius: 0,
  },
  statTrack: {
    height: 7,
    overflow: "hidden",
    borderWidth: border.hairline,
    borderColor: palette.ink,
    borderRadius: radius.sm,
    backgroundColor: palette.track,
  },
});
