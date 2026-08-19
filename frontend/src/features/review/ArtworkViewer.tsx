import { Button } from "@trussworks/react-uswds";

import { labelImageUrl } from "../../services/api";
import { FIELD_LABELS } from "../../types";
import { FIELD_REGIONS } from "./fieldRegions";
import styles from "./review.module.scss";

interface ArtworkViewerProps {
  applicationId: string;
  /** Which field to highlight, or null to show the whole panel. */
  focusField: string | null;
  zoom: number;
  onZoom: (zoom: number) => void;
  onFit: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;

export function ArtworkViewer({
  applicationId,
  focusField,
  zoom,
  onZoom,
  onFit,
}: ArtworkViewerProps): React.ReactElement {
  const region = focusField === null ? null : FIELD_REGIONS[focusField];
  // Zooming about the region's centre keeps the field on screen as it scales.
  const origin =
    region === undefined || region === null
      ? "50% 50%"
      : `${String(region.x + region.w / 2)}% ${String(region.y + region.h / 2)}%`;

  return (
    <section className={styles.panel} aria-label="Artwork sent in">
      <header className={styles.viewerHeader}>
        <span className={styles.smallCaps}>Artwork sent in</span>
        <span className={styles.zoomControls}>
          <Button
            type="button"
            unstyled
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => {
              onZoom(Math.max(MIN_ZOOM, zoom - STEP));
            }}
          >
            −
          </Button>
          <Button
            type="button"
            unstyled
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => {
              onZoom(Math.min(MAX_ZOOM, zoom + STEP));
            }}
          >
            +
          </Button>
          <Button type="button" unstyled onClick={onFit}>
            Fit
          </Button>
        </span>
      </header>

      <div className={styles.viewport}>
        <div
          className={styles.stage}
          style={{ transform: `scale(${String(zoom)})`, transformOrigin: origin }}
        >
          <img
            src={labelImageUrl(applicationId)}
            alt={`Label artwork submitted for ${applicationId}`}
            className={styles.artwork}
          />
          {region !== undefined && region !== null && (
            <span
              className={styles.regionMarker}
              style={{
                left: `${String(region.x)}%`,
                top: `${String(region.y)}%`,
                width: `${String(region.w)}%`,
                height: `${String(region.h)}%`,
              }}
            />
          )}
        </div>
      </div>

      <footer className={styles.viewerFooter}>
        {focusField === null
          ? "Select a row on the left to zoom to that field."
          : `Showing where ${(
              FIELD_LABELS[focusField] ?? focusField
            ).toLowerCase()} sits on the panel. Region is approximate.`}
      </footer>
    </section>
  );
}
