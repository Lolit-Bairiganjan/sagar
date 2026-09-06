import { GlobeCollection } from '../shaders/globe/GlobeCollection';
import '../shaders/threeui.css';

/**
 * Landing-page globe using the exact ThreeUI Energy Orb configuration supplied
 * for the SAGAR startup screen.
 */
export default function LandingGlobe() {
  return (
    <div className="shader-frame absolute inset-0 h-full w-full">
      <GlobeCollection
        variant="energy-orb"
        speed={1.0}
        scale={0.7}
        smokeScale={1.0}
        smokeStrength={1.0}
        smokeSpeed={1.0}
        hue={-21}
        saturation={1.0}
        glow={1.0}
        starDensity={1.0}
        starSpeed={1.0}
        starSize={1.6}
        brightness={0.8}
        opacity={1.0}
      />
    </div>
  );
}
