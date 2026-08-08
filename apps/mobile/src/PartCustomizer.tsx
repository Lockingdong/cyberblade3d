import { useState, type JSX } from "react";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BEYBLADES,
  BLADE_PARTS,
  RATCHET_PARTS,
  BIT_PARTS,
  CHIP_PARTS,
  assembleBeybladeSpec,
  getCompatibleParts,
  type BeybladeSpec,
  type BeybladeType,
  type CustomBeybladeConfig,
} from "@cyberblade/core";
import {
  PREVIEW_CAMERA_PRESETS,
  PREVIEW_CAMERA_PRESET_ORDER,
  type PreviewCameraPreset,
} from "@cyberblade/visuals";
import { border, palette, radius, spacing } from "@cyberblade/design-system";
import { BladePreviewScene } from "./BladePreviewScene";
import { PaperBackdrop, PrimaryButton } from "./ui";
import {
  BitSlotIcon,
  BladeSlotIcon,
  CameraPresetIcon,
  ChipSlotIcon,
  ExplodedLayersIcon,
  GarageIcon,
  InfoIcon,
  RatchetSlotIcon,
  StatsChartIcon,
} from "./CustomizerIcons";
import { selectionFeedback } from "./feedback";

export type PartSlot = "blade" | "ratchet" | "bit" | "chip";

const SLOT_ORDER: readonly PartSlot[] = ["blade", "ratchet", "bit", "chip"];

const SLOT_LABELS: Record<
  PartSlot,
  {
    title: string;
    englishTitle: string;
    Icon: (props: { color?: string; size?: number }) => JSX.Element;
    desc: string;
  }
> = {
  blade: {
    title: "攻擊刀刃",
    englishTitle: "Blade",
    Icon: BladeSlotIcon,
    desc: "決定碰撞物理外型、基礎攻擊力與主要 AI 戰術風格。",
  },
  ratchet: {
    title: "棘輪",
    englishTitle: "Ratchet",
    Icon: RatchetSlotIcon,
    desc: "控制陀螺高度與最大穩定度 (Max Stability)，影響防爆係數。",
  },
  bit: {
    title: "軸心",
    englishTitle: "Bit",
    Icon: BitSlotIcon,
    desc: "決定極限轉速 (Max RPM)、轉速衰減與地面摩擦滑行速度。",
  },
  chip: {
    title: "核心晶片",
    englishTitle: "Chip",
    Icon: ChipSlotIcon,
    desc: "核心精神與標識，綁定陀螺精神象徵與限定氣場。",
  },
};

/**
 * The mobile garage — a port of the web PartCustomizerModal
 * (apps/web/src/PartCustomizerModal.tsx). Same parts, same stats panel, same
 * preview poses; the two-column desktop layout becomes one scrolling column.
 *
 * Rendered in a native Modal so it covers the GL battle scene, which the
 * ShareCardModal already proved works with an expo-gl Canvas inside.
 */
export function PartCustomizer({
  isOpen,
  onClose,
  beybladeType,
  config,
  onChangeConfig,
}: {
  isOpen: boolean;
  onClose: () => void;
  beybladeType: BeybladeType;
  config: CustomBeybladeConfig;
  onChangeConfig: (next: CustomBeybladeConfig) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<PartSlot>("blade");
  const [cameraPreset, setCameraPreset] =
    useState<PreviewCameraPreset>("default");
  const [isExploded, setIsExploded] = useState(false);

  if (!isOpen) return null;

  const defaultSpec: BeybladeSpec = BEYBLADES[beybladeType];
  const currentSpec: BeybladeSpec = assembleBeybladeSpec(config);
  const allowed = getCompatibleParts(beybladeType);

  function partsForSlot(slot: PartSlot) {
    switch (slot) {
      case "blade":
        return allowed.allowedBlades
          .map((id) => BLADE_PARTS[id])
          .filter((part): part is NonNullable<typeof part> => Boolean(part));
      case "ratchet":
        return allowed.allowedRatchets
          .map((id) => RATCHET_PARTS[id])
          .filter((part): part is NonNullable<typeof part> => Boolean(part));
      case "bit":
        return allowed.allowedBits
          .map((id) => BIT_PARTS[id])
          .filter((part): part is NonNullable<typeof part> => Boolean(part));
      case "chip":
        return allowed.allowedChips
          .map((id) => CHIP_PARTS[id])
          .filter((part): part is NonNullable<typeof part> => Boolean(part));
    }
  }

  const currentParts = partsForSlot(activeSlot);
  const activeInfo = SLOT_LABELS[activeSlot];
  const ActiveSlotIcon = activeInfo.Icon;

  function cycleCameraPreset(): void {
    selectionFeedback();
    const order = PREVIEW_CAMERA_PRESET_ORDER;
    const index = order.indexOf(cameraPreset);
    setCameraPreset(order[(index + 1) % order.length] ?? "default");
  }

  function equippedIdFor(slot: PartSlot): string {
    switch (slot) {
      case "blade":
        return config.bladeId;
      case "ratchet":
        return config.ratchetId;
      case "bit":
        return config.bitId;
      case "chip":
        return config.chipId;
    }
  }

  function selectPart(partId: string): void {
    selectionFeedback();
    onChangeConfig({
      type: config.type,
      bladeId: activeSlot === "blade" ? partId : config.bladeId,
      ratchetId: activeSlot === "ratchet" ? partId : config.ratchetId,
      bitId: activeSlot === "bit" ? partId : config.bitId,
      chipId: activeSlot === "chip" ? partId : config.chipId,
      ...(config.name ? { name: config.name } : {}),
      ...(config.englishName ? { englishName: config.englishName } : {}),
    });
  }

  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <PaperBackdrop />
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.headerTitleRow}>
              <GarageIcon size={20} color={palette.cyan} />
              <Text style={styles.headerTitle}>陀螺改裝工坊</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              【{defaultSpec.name}】部位零件切換與數值微調
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉改裝工坊"
            style={styles.closeButton}
            onPress={() => {
              selectionFeedback();
              onClose();
            }}
          >
            <Text style={styles.closeMark}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.stage}>
            <BladePreviewScene
              type={beybladeType}
              customSpec={currentSpec}
              exploded={isExploded}
              preset={cameraPreset}
            />
            <View style={styles.stageControls} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`切換視角 (目前：${PREVIEW_CAMERA_PRESETS[cameraPreset].label})`}
                style={styles.stageButton}
                onPress={cycleCameraPreset}
              >
                <CameraPresetIcon preset={cameraPreset} color={palette.ink} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isExploded ? "切換組裝檢視" : "切換 4 零件拆解視圖"
                }
                style={[styles.stageButton, isExploded && styles.stageButtonOn]}
                onPress={() => {
                  selectionFeedback();
                  setIsExploded(!isExploded);
                }}
              >
                <ExplodedLayersIcon
                  color={isExploded ? palette.card : palette.ink}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.tabs}>
            {SLOT_ORDER.map((slot) => {
              const info = SLOT_LABELS[slot];
              const TabIcon = info.Icon;
              const active = activeSlot === slot;
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => {
                    selectionFeedback();
                    setActiveSlot(slot);
                  }}
                >
                  <TabIcon
                    size={16}
                    color={active ? palette.card : palette.inkFaint}
                  />
                  <Text style={[styles.tabTitle, active && styles.tabTitleOn]}>
                    {info.title}
                  </Text>
                  <Text
                    style={[styles.tabEnglish, active && styles.tabTitleOn]}
                  >
                    {info.englishTitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.slotInfo}>
            <View style={styles.headerTitleRow}>
              <ActiveSlotIcon size={16} color={palette.cyan} />
              <Text style={styles.slotInfoTitle}>
                {activeInfo.title}
                <Text style={styles.slotInfoEnglish}>
                  {" "}
                  ({activeInfo.englishTitle})
                </Text>
              </Text>
            </View>
            <Text style={styles.slotInfoDesc}>{activeInfo.desc}</Text>
          </View>

          {currentParts.map((part) => {
            const equipped = equippedIdFor(activeSlot) === part.id;
            // The `typeof` guards are what narrow these off the part union —
            // an `in` check alone leaves TypeScript with `{}`.
            const mass =
              "massContribution" in part &&
              typeof part.massContribution === "number"
                ? part.massContribution
                : null;
            const ai =
              "ai" in part && typeof part.ai === "string" ? part.ai : null;
            const stability =
              "maxStability" in part && typeof part.maxStability === "number"
                ? part.maxStability
                : null;
            const maxRpm =
              "maxRpm" in part && typeof part.maxRpm === "number"
                ? part.maxRpm
                : null;

            return (
              <Pressable
                key={part.id}
                accessibilityRole="button"
                accessibilityState={{ selected: equipped }}
                style={[styles.partCard, equipped && styles.partCardOn]}
                onPress={() => selectPart(part.id)}
              >
                <View style={styles.partCardHeader}>
                  <Text style={styles.partName}>{part.name}</Text>
                  <Text style={styles.partEnglish}>{part.englishName}</Text>
                </View>
                <View style={styles.partAttrs}>
                  {mass !== null && (
                    <Text style={styles.partAttr}>重量 +{mass} kg</Text>
                  )}
                  {ai !== null && (
                    <Text style={styles.partAttr}>風格 {ai}</Text>
                  )}
                  {stability !== null && (
                    <Text style={styles.partAttr}>穩定 {stability} pts</Text>
                  )}
                  {maxRpm !== null && (
                    <Text style={styles.partAttr}>轉速 {maxRpm} RPM</Text>
                  )}
                </View>
                <Text
                  style={[styles.partStatus, equipped && styles.partStatusOn]}
                >
                  {equipped ? "✓ 已裝備" : "點擊裝備"}
                </Text>
              </Pressable>
            );
          })}

          {currentParts.length === 1 && (
            <View style={styles.singlePartHint}>
              <InfoIcon size={15} color={palette.inkMuted} />
              <Text style={styles.singlePartHintText}>
                目前該部位僅有原廠預設零件，後續版本將解鎖更多可替換改裝件。
              </Text>
            </View>
          )}

          <View style={styles.statsPanel}>
            <View style={styles.headerTitleRow}>
              <StatsChartIcon size={16} color={palette.cyan} />
              <Text style={styles.statsTitle}>性能指標 (Stats Diff)</Text>
            </View>
            <Text style={styles.statsHint}>
              相較於【{defaultSpec.name}】原廠標準配置：
            </Text>
            <StatDiffRow
              label="重量 (Mass)"
              current={currentSpec.mass}
              base={defaultSpec.mass}
              unit="kg"
              decimals={2}
            />
            <StatDiffRow
              label="極限轉速 (Max RPM)"
              current={currentSpec.maxRpm}
              base={defaultSpec.maxRpm}
              unit="RPM"
              decimals={0}
            />
            <StatDiffRow
              label="轉速衰減 (Spin Decay)"
              current={currentSpec.rpmDecay}
              base={defaultSpec.rpmDecay}
              unit="/s"
              decimals={0}
            />
            <StatDiffRow
              label="最大穩定度 (Stability)"
              current={currentSpec.maxStability}
              base={defaultSpec.maxStability}
              unit="pts"
              decimals={0}
            />
            <StatDiffRow
              label="移動速度 (Speed)"
              current={currentSpec.speed}
              base={defaultSpec.speed}
              unit="m/s"
              decimals={1}
            />
            <StatDiffRow
              label="撞擊承受率 (Damage Taken)"
              current={currentSpec.damageTaken * 100}
              base={defaultSpec.damageTaken * 100}
              unit="%"
              decimals={0}
            />
          </View>

          <PrimaryButton
            label="完成組裝"
            style={styles.confirmButton}
            onPress={() => {
              selectionFeedback();
              onClose();
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function StatDiffRow({
  label,
  current,
  base,
  unit,
  decimals,
}: {
  label: string;
  current: number;
  base: number;
  unit: string;
  decimals: number;
}) {
  const diff = current - base;
  const unchanged = Math.abs(diff) < 0.001;
  const value =
    decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
  const delta =
    decimals > 0 ? diff.toFixed(decimals) : String(Math.round(diff));

  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueGroup}>
        <Text style={styles.statValue}>
          {value} {unit}
        </Text>
        {!unchanged && (
          <Text
            style={[
              styles.statDelta,
              diff > 0 ? styles.statDeltaUp : styles.statDeltaDown,
            ]}
          >
            {diff > 0 ? `+${delta}` : delta}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: border.thick,
    borderBottomColor: palette.ink,
    backgroundColor: palette.card,
  },
  headerCopy: { flex: 1 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerSubtitle: { marginTop: 4, color: palette.inkMuted, fontSize: 12 },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  closeMark: { color: palette.ink, fontSize: 16, fontWeight: "900" },
  body: { padding: spacing.md, paddingBottom: 56, gap: spacing.sm },
  stage: {
    height: 280,
    borderWidth: border.thick,
    borderColor: palette.ink,
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    overflow: "hidden",
  },
  stageControls: { position: "absolute", top: 10, right: 10, gap: 8 },
  stageButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  stageButtonOn: { backgroundColor: palette.cyan },
  tabs: { flexDirection: "row", gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  tabActive: { backgroundColor: palette.cyan },
  tabTitle: { color: palette.ink, fontSize: 11, fontWeight: "900" },
  tabEnglish: { color: palette.inkFaint, fontSize: 8, letterSpacing: 1 },
  tabTitleOn: { color: palette.card },
  slotInfo: {
    padding: spacing.md,
    borderWidth: border.thin,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  slotInfoTitle: { color: palette.ink, fontSize: 14, fontWeight: "900" },
  slotInfoEnglish: {
    color: palette.inkFaint,
    fontSize: 11,
    fontWeight: "600",
  },
  slotInfoDesc: {
    marginTop: 6,
    color: palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  partCard: {
    padding: spacing.md,
    borderWidth: border.thin,
    borderColor: palette.ruleStrong,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  // Equipped reads as an ink outline rather than a colour wash, so the state is
  // legible for players who cannot separate the tint from the plain card.
  partCardOn: {
    borderWidth: border.thick,
    borderColor: palette.cyan,
    backgroundColor: "rgba(0, 155, 214, 0.08)",
  },
  partCardHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  partName: { color: palette.ink, fontSize: 15, fontWeight: "900" },
  partEnglish: { color: palette.inkFaint, fontSize: 10, letterSpacing: 1 },
  partAttrs: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  partAttr: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
    color: palette.inkMuted,
    fontSize: 10,
    fontWeight: "800",
    borderWidth: border.hairline,
    borderColor: palette.ruleStrong,
    borderRadius: radius.pill,
  },
  partStatus: {
    marginTop: 10,
    color: palette.inkFaint,
    fontSize: 11,
    fontWeight: "800",
  },
  partStatusOn: { color: palette.cyan },
  singlePartHint: {
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  singlePartHintText: {
    flex: 1,
    color: palette.inkMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  statsPanel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: border.thin,
    borderColor: palette.ink,
    borderRadius: radius.md,
    backgroundColor: palette.card,
  },
  statsTitle: { color: palette.ink, fontSize: 14, fontWeight: "900" },
  statsHint: {
    marginTop: 6,
    marginBottom: 4,
    color: palette.inkMuted,
    fontSize: 11,
  },
  statRow: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: border.hairline,
    borderBottomColor: palette.rule,
  },
  statLabel: { color: palette.inkMuted, fontSize: 12 },
  statValueGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  statValue: { color: palette.ink, fontSize: 12, fontWeight: "800" },
  statDelta: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
  },
  statDeltaUp: { color: palette.card, backgroundColor: palette.positive },
  statDeltaDown: { color: palette.card, backgroundColor: palette.danger },
  confirmButton: { marginTop: spacing.md },
});
