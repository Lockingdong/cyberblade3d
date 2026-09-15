import { lazy, Suspense, type ComponentProps } from "react";

const loadBattle = () => import("./BattleScene");
const Battle = lazy(() =>
  loadBattle().then((module) => ({ default: module.BattleScene })),
);
const Preview = lazy(() =>
  import("./BladePreviewScene").then((module) => ({
    default: module.BladePreviewScene,
  })),
);
const Customizer = lazy(() =>
  import("./PartCustomizerModal").then((module) => ({
    default: module.PartCustomizerModal,
  })),
);
const Share = lazy(() =>
  import("./ShareCardModal").then((module) => ({
    default: module.ShareCardModal,
  })),
);

export function preloadBattleScene(): void {
  void loadBattle().catch(() => {});
}
const loading = (
  <div role="status" className="scene-loading">
    載入畫面中…
  </div>
);
export function BattleScene(props: ComponentProps<typeof Battle>) {
  return (
    <Suspense fallback={loading}>
      <Battle {...props} />
    </Suspense>
  );
}
export function BladePreviewScene(props: ComponentProps<typeof Preview>) {
  return (
    <Suspense fallback={loading}>
      <Preview {...props} />
    </Suspense>
  );
}
export function PartCustomizerModal(props: ComponentProps<typeof Customizer>) {
  return (
    <Suspense fallback={loading}>
      <Customizer {...props} />
    </Suspense>
  );
}
export function ShareCardModal(props: ComponentProps<typeof Share>) {
  return (
    <Suspense fallback={loading}>
      <Share {...props} />
    </Suspense>
  );
}
