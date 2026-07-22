import React, { useState, type JSX } from "react";
import {
  BEYBLADES,
  BLADE_PARTS,
  RATCHET_PARTS,
  BIT_PARTS,
  CHIP_PARTS,
  assembleBeybladeSpec,
  getCompatibleParts,
  type BeybladeType,
  type CustomBeybladeConfig,
  type BeybladeSpec,
} from "@game-pool/beyblade-core";
import {
  BladePreviewScene,
  CAMERA_PRESETS,
  ExplodedLayersIcon,
  type CameraPreset,
} from "./BladePreviewScene";
import { synth } from "./audio";
import {
  GarageIcon,
  BladeSlotIcon,
  RatchetSlotIcon,
  BitSlotIcon,
  ChipSlotIcon,
  StatsChartIcon,
  InfoIcon,
} from "./components/CustomizerIcons";

export type PartSlot = "blade" | "ratchet" | "bit" | "chip";

interface PartCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  beybladeType: BeybladeType;
  config: CustomBeybladeConfig;
  onChangeConfig: (newConfig: CustomBeybladeConfig) => void;
}

const SLOT_LABELS: Record<
  PartSlot,
  { title: string; englishTitle: string; icon: JSX.Element; desc: string }
> = {
  blade: {
    title: "攻擊刀刃",
    englishTitle: "Blade",
    icon: <BladeSlotIcon size={18} />,
    desc: "決定碰撞物理外型、基礎攻擊力與主要 AI 戰術風格。",
  },
  ratchet: {
    title: "棘輪",
    englishTitle: "Ratchet",
    icon: <RatchetSlotIcon size={18} />,
    desc: "控制陀螺高度與最大穩定度 (Max Stability)，影響防爆係數。",
  },
  bit: {
    title: "軸心",
    englishTitle: "Bit",
    icon: <BitSlotIcon size={18} />,
    desc: "決定極限轉速 (Max RPM)、轉速衰減與地面摩擦滑行速度。",
  },
  chip: {
    title: "核心晶片",
    englishTitle: "Chip",
    icon: <ChipSlotIcon size={18} />,
    desc: "核心精神與標識，綁定陀螺精神象徵與限定氣場。",
  },
};

export function PartCustomizerModal({
  isOpen,
  onClose,
  beybladeType,
  config,
  onChangeConfig,
}: PartCustomizerModalProps) {
  const [activeSlot, setActiveSlot] = useState<PartSlot>("blade");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("default");
  const [isExploded, setIsExploded] = useState(false);

  const presetKeys: CameraPreset[] = ["default", "top", "side", "bottom"];
  const handleCycleCameraPreset = () => {
    synth.click();
    const currentIndex = presetKeys.indexOf(cameraPreset);
    const nextPreset =
      presetKeys[(currentIndex + 1) % presetKeys.length] ?? "default";
    setCameraPreset(nextPreset);
  };

  if (!isOpen) return null;

  const defaultSpec: BeybladeSpec = BEYBLADES[beybladeType];
  const currentSpec: BeybladeSpec = assembleBeybladeSpec(config);
  const allowed = getCompatibleParts(beybladeType);

  const getPartList = (slot: PartSlot) => {
    switch (slot) {
      case "blade":
        return allowed.allowedBlades
          .map((id) => BLADE_PARTS[id])
          .filter((p): p is NonNullable<typeof p> => Boolean(p));
      case "ratchet":
        return allowed.allowedRatchets
          .map((id) => RATCHET_PARTS[id])
          .filter((p): p is NonNullable<typeof p> => Boolean(p));
      case "bit":
        return allowed.allowedBits
          .map((id) => BIT_PARTS[id])
          .filter((p): p is NonNullable<typeof p> => Boolean(p));
      case "chip":
        return allowed.allowedChips
          .map((id) => CHIP_PARTS[id])
          .filter((p): p is NonNullable<typeof p> => Boolean(p));
    }
  };

  const currentPartList = getPartList(activeSlot);

  const handleSelectPart = (partId: string) => {
    synth.click();
    const nextConfig: CustomBeybladeConfig = {
      type: config.type,
      bladeId: activeSlot === "blade" ? partId : config.bladeId,
      ratchetId: activeSlot === "ratchet" ? partId : config.ratchetId,
      bitId: activeSlot === "bit" ? partId : config.bitId,
      chipId: activeSlot === "chip" ? partId : config.chipId,
      ...(config.name ? { name: config.name } : {}),
      ...(config.englishName ? { englishName: config.englishName } : {}),
    };
    onChangeConfig(nextConfig);
  };

  // Helper for stats diff formatting
  const renderStatDiff = (
    label: string,
    currentVal: number,
    defaultVal: number,
    unit: string,
    formatFixed = 2,
  ) => {
    const diff = currentVal - defaultVal;
    const isZero = Math.abs(diff) < 0.001;

    let badgeClass = "diff-neutral";
    if (!isZero) {
      badgeClass = diff > 0 ? "diff-positive" : "diff-negative";
    }

    const formattedVal =
      formatFixed > 0 ? currentVal.toFixed(formatFixed) : Math.round(currentVal);
    const formattedDiff =
      formatFixed > 0
        ? (diff > 0 ? `+${diff.toFixed(formatFixed)}` : diff.toFixed(formatFixed))
        : diff > 0
        ? `+${Math.round(diff)}`
        : `${Math.round(diff)}`;

    return (
      <div className="stat-diff-row">
        <span className="stat-label">{label}</span>
        <span className="stat-value">
          {formattedVal} {unit}
          {!isZero && (
            <span className={`diff-badge ${badgeClass}`}>{formattedDiff}</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="customizer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <header className="customizer-header">
          <div className="customizer-header-title">
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <GarageIcon size={22} />
              <span>陀螺改裝工坊 (GARAGE)</span>
            </h2>
            <p className="subtitle">
              【{defaultSpec.name}】部位零件切換與數值微調
            </p>
          </div>
          <button
            className="customizer-close-btn"
            onClick={() => {
              synth.click();
              onClose();
            }}
            aria-label="關閉"
          >
            ✕
          </button>
        </header>

        {/* 頂部全寬 3D 展示舞台 (Top 3D Stage) */}
        <div className="customizer-top-3d-stage">
          <div className="preview-controls-bar">
            <button
              className="preview-control-btn camera-cycle-btn"
              onClick={handleCycleCameraPreset}
              title={`切換視角 (目前：${CAMERA_PRESETS[cameraPreset].label})`}
              aria-label={`切換視角 (目前：${CAMERA_PRESETS[cameraPreset].label})`}
            >
              {CAMERA_PRESETS[cameraPreset].icon}
            </button>
            <button
              className={`preview-control-btn exploded-toggle-btn ${isExploded ? "active" : ""}`}
              onClick={() => {
                synth.click();
                setIsExploded(!isExploded);
              }}
              title={isExploded ? "切換組裝檢視" : "切換 4 零件拆解視圖"}
              aria-label={isExploded ? "切換組裝檢視" : "切換 4 零件拆解視圖"}
            >
              <ExplodedLayersIcon />
            </button>
          </div>
          <BladePreviewScene
            type={beybladeType}
            customSpec={currentSpec}
            exploded={isExploded}
            preset={cameraPreset}
            showExplodedLabels={false}
          />
        </div>

        {/* 下半部：部位頁籤 + 左側選擇 + 右側指標 */}
        <div className="customizer-bottom-section">
          {/* 左側：部位 Tabs 與零件選單 */}
          <div className="part-selector-panel">
            <nav className="customizer-tabs">
              {(["blade", "ratchet", "bit", "chip"] as PartSlot[]).map((slot) => {
                const info = SLOT_LABELS[slot];
                const active = activeSlot === slot;
                const count = getPartList(slot).length;

                return (
                  <button
                    key={slot}
                    className={`tab-btn ${active ? "active" : ""}`}
                    onClick={() => {
                      synth.click();
                      setActiveSlot(slot);
                    }}
                  >
                    <span className="tab-icon">{info.icon}</span>
                    <span className="tab-text">
                      <span className="tab-title">{info.title}</span>
                      <span className="tab-eng">{info.englishTitle}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="slot-info-box">
              <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {SLOT_LABELS[activeSlot].icon}
                <span>{SLOT_LABELS[activeSlot].title}</span>
                <span className="eng">
                  ({SLOT_LABELS[activeSlot].englishTitle})
                </span>
              </h3>
              <p>{SLOT_LABELS[activeSlot].desc}</p>
            </div>

            <div className="part-cards-grid">
              {currentPartList.map((part) => {
                let isEquipped = false;
                if (activeSlot === "blade") isEquipped = config.bladeId === part.id;
                if (activeSlot === "ratchet") isEquipped = config.ratchetId === part.id;
                if (activeSlot === "bit") isEquipped = config.bitId === part.id;
                if (activeSlot === "chip") isEquipped = config.chipId === part.id;

                const mass =
                  "massContribution" in part &&
                  typeof part.massContribution === "number"
                    ? part.massContribution
                    : null;
                const ai =
                  "ai" in part && typeof part.ai === "string" ? part.ai : null;
                const stability =
                  "maxStability" in part &&
                  typeof part.maxStability === "number"
                    ? part.maxStability
                    : null;
                const maxRpm =
                  "maxRpm" in part && typeof part.maxRpm === "number"
                    ? part.maxRpm
                    : null;

                return (
                  <div
                    key={part.id}
                    className={`part-card ${isEquipped ? "equipped" : ""}`}
                    onClick={() => handleSelectPart(part.id)}
                  >
                    <div className="part-card-header">
                      <span className="part-name">{part.name}</span>
                      <span className="part-eng">{part.englishName}</span>
                    </div>

                    <div className="part-card-details">
                      {mass !== null && (
                        <span className="part-attr">重量: +{mass} kg</span>
                      )}
                      {ai !== null && (
                        <span className="part-attr">風格: {ai}</span>
                      )}
                      {stability !== null && (
                        <span className="part-attr">穩定: {stability} pts</span>
                      )}
                      {maxRpm !== null && (
                        <span className="part-attr">轉速: {maxRpm} RPM</span>
                      )}
                    </div>

                    {isEquipped ? (
                      <span className="status-tag active">✓ 已裝備</span>
                    ) : (
                      <span className="status-tag action">點擊裝備</span>
                    )}
                  </div>
                );
              })}

              {currentPartList.length === 1 && (
                <div
                  className="single-part-hint"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <InfoIcon size={16} />
                  <span>
                    目前該部位僅有原廠預設零件，後續版本將解鎖更多可替換改裝件。
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 右側：性能指標增減比對面板 */}
          <div className="part-stats-panel">
            <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <StatsChartIcon size={18} />
              <span>性能指標 (Stats Diff)</span>
            </h3>
            <p className="panel-hint">相較於【{defaultSpec.name}】原廠標準配置：</p>

            <div className="stats-diff-container">
              {renderStatDiff(
                "重量 (Mass)",
                currentSpec.mass,
                defaultSpec.mass,
                "kg",
                2,
              )}
              {renderStatDiff(
                "極限轉速 (Max RPM)",
                currentSpec.maxRpm,
                defaultSpec.maxRpm,
                "RPM",
                0,
              )}
              {renderStatDiff(
                "轉速衰減 (Spin Decay)",
                currentSpec.rpmDecay,
                defaultSpec.rpmDecay,
                "/s",
                0,
              )}
              {renderStatDiff(
                "最大穩定度 (Stability)",
                currentSpec.maxStability,
                defaultSpec.maxStability,
                "pts",
                0,
              )}
              {renderStatDiff(
                "移動速度 (Speed)",
                currentSpec.speed,
                defaultSpec.speed,
                "m/s",
                1,
              )}
              {renderStatDiff(
                "撞擊承受率 (Damage Taken)",
                currentSpec.damageTaken * 100,
                defaultSpec.damageTaken * 100,
                "%",
                0,
              )}
            </div>

            <div className="customizer-footer">
              <button
                className="confirm-btn"
                onClick={() => {
                  synth.click();
                  onClose();
                }}
              >
                完成組裝
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

