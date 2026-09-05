import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { EnergyOrbProps } from "../energy-orb/EnergyOrb";
import networkGlobeSource from "./sources/network-globe.html?raw";
import tangledConstellationsSource from "./sources/tangled-constellations.html?raw";

export type GlobeVariant = "energy-orb" | "tangled-constellations" | "network-globe";

export type GlobeCanvasProps = {
  variant: Exclude<GlobeVariant, "energy-orb">;
  speed?: number;
  scale?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

type EnergyOrbVariantProps = EnergyOrbProps & {
  variant?: "energy-orb";
};

export type GlobeCollectionProps = EnergyOrbVariantProps | GlobeCanvasProps;

export const GLOBE_CANVAS_DEFAULTS = {
  speed: 1,
  scale: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const;

const SOURCE_BY_VARIANT: Record<GlobeCanvasProps["variant"], string> = {
  "tangled-constellations": tangledConstellationsSource,
  "network-globe": networkGlobeSource,
};

const EnergyOrbVariant = lazy(() =>
  import("../energy-orb/EnergyOrb").then((module) => ({ default: module.EnergyOrb })),
);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function buildGlobeDocument(variant: GlobeCanvasProps["variant"]) {
  const focusStyles = `<style data-globe-collection-focus>
:root { --globe-collection-scale: 1; }
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
canvas { transform: scale(var(--globe-collection-scale)); transform-origin: 50% 50%; }
</style>`;
  const controls = `<script data-globe-collection-controls>
(function () {
  var nativeFrame = window.requestAnimationFrame.bind(window);
  var clock = { real: null, virtual: null };
  var controls = window.__GLOBE_COLLECTION_CONTROLS = { speed: 1, scale: 1, paused: false };
  window.__GLOBE_COLLECTION_NOW = function () {
    return clock.virtual === null ? performance.now() : clock.virtual;
  };
  window.requestAnimationFrame = function (callback) {
    function tick(realTime) {
      if (clock.real === null) {
        clock.real = realTime;
        clock.virtual = realTime;
      } else {
        if (!controls.paused) clock.virtual += (realTime - clock.real) * controls.speed;
        clock.real = realTime;
      }
      if (controls.paused) return nativeFrame(tick);
      callback(clock.virtual);
    }
    return nativeFrame(tick);
  };
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'globe-collection-controls') return;
    var next = event.data.controls || {};
    if (Number.isFinite(next.speed)) controls.speed = Math.max(0, Math.min(3, next.speed));
    if (Number.isFinite(next.scale)) controls.scale = Math.max(0.65, Math.min(1.35, next.scale));
    controls.paused = Boolean(next.paused);
    document.documentElement.style.setProperty('--globe-collection-scale', String(controls.scale));
    window.dispatchEvent(new Event('resize'));
  });
})();
</script>`;

  const adaptedSource = SOURCE_BY_VARIANT[variant]
    .replaceAll("performance.now()", "window.__GLOBE_COLLECTION_NOW()");

  return adaptedSource
    .replace(/<script[^>]+cloudflareinsights\.com[^>]*><\/script>/gi, "")
    .replace("</head>", `${focusStyles}${controls}</head>`);
}

function GlobeCanvasScene({
  variant,
  speed = GLOBE_CANVAS_DEFAULTS.speed,
  scale = GLOBE_CANVAS_DEFAULTS.scale,
  opacity = GLOBE_CANVAS_DEFAULTS.opacity,
  hue = GLOBE_CANVAS_DEFAULTS.hue,
  saturation = GLOBE_CANVAS_DEFAULTS.saturation,
  brightness = GLOBE_CANVAS_DEFAULTS.brightness,
  className = "",
  style,
}: GlobeCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hostVisible, setHostVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const safeSpeed = clamp(speed, 0, 3);
  const safeScale = clamp(scale, 0.65, 1.35);
  const paused = !hostVisible || !documentVisible || safeSpeed === 0;
  const source = useMemo(() => buildGlobeDocument(variant), [variant]);

  const postControls = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({
      type: "globe-collection-controls",
      controls: { speed: safeSpeed, scale: safeScale, paused },
    }, "*");
  }, [paused, safeScale, safeSpeed]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setHostVisible(entry?.isIntersecting ?? true));
    observer.observe(iframe);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    postControls();
  }, [postControls, source]);

  const isTangled = variant === "tangled-constellations";
  return (
    <div
      className={`threeui-background globe-collection globe-collection--${variant}${className ? ` ${className}` : ""}`}
      style={{ background: isTangled ? "#131313" : "#272727", pointerEvents: "auto", ...style }}
    >
      <iframe
        ref={iframeRef}
        title={isTangled ? "Interactive tangled constellations globe" : "Interactive network globe"}
        srcDoc={source}
        sandbox="allow-scripts"
        onLoad={postControls}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background: isTangled ? "#131313" : "#272727",
          opacity: clamp(opacity, 0.05, 1),
          filter: `hue-rotate(${clamp(hue, -180, 180)}deg) saturate(${clamp(saturation, 0, 2)}) brightness(${clamp(brightness, 0.35, 1.65)})`,
        }}
      />
    </div>
  );
}

export function GlobeCollection(props: GlobeCollectionProps) {
  if (props.variant === "tangled-constellations" || props.variant === "network-globe") {
    return <GlobeCanvasScene {...props} />;
  }

  const { variant: _variant, ...energyOrbProps } = props;
  return (
    <Suspense fallback={<div className="threeui-background energy-orb" style={{ background: "#05030e" }} />}>
      <EnergyOrbVariant {...energyOrbProps} />
    </Suspense>
  );
}

export function TangledConstellations(props: Omit<GlobeCanvasProps, "variant">) {
  return <GlobeCanvasScene {...props} variant="tangled-constellations" />;
}

export function NetworkGlobe(props: Omit<GlobeCanvasProps, "variant">) {
  return <GlobeCanvasScene {...props} variant="network-globe" />;
}