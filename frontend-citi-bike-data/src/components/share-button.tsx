import { MapButtonStyle } from "@/map/map-button";
import ContentPasteRoundedIcon from "@mui/icons-material/ContentPasteRounded";
import { useMapConfigStore } from "@/store/store";
import { useLayerVisibilityStore } from "@/store/layer-visibility-store";
import { createShareableUrl, type ShareableConfig } from "@/utils/share-config";
import { calculateCellsBounds } from "@/utils/cell-bounds";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useState } from "react";
import classNames from "classnames";

export const ShareButton: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const {
    selectedMonth,
    originCells,
    destinationCells,
    displayType,
    normalizeComparison,
    scale,
    scaleType,
  } = useMapConfigStore();
  const layerGroups = useLayerVisibilityStore((state) => state.layerGroups);

  const handleShare = async () => {
    // Calculate bounding box from all selected cells
    const allCells = [...originCells, ...destinationCells];
    const bounds = calculateCellsBounds(allCells);

    // Gather all current configuration
    const config: ShareableConfig = {
      selectedMonth,
      originCells,
      destinationCells,
      displayType,
      normalizeComparison,
      scale,
      scaleType,
      visibleLayers: layerGroups
        .filter((group) => group.visible)
        .map((group) => group.id),
      bounds,
    };

    // Create shareable URL
    const url = createShareableUrl(config);

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      // Fallback: show alert with URL
      alert(`Share this URL:\n\n${url}`);
    }
  };

  return (
    <button
      onClick={handleShare}
      title={copied ? "Link copied!" : "Share configuration"}
      className={classNames(MapButtonStyle, "relative")}
    >
      {copied ? (
        <CheckRoundedIcon fontSize="small" className="text-green-600" />
      ) : (
        <ShareRoundedIcon fontSize="small" />
      )}

      <div
        className={classNames(
          "absolute top-0 pb-2 text-gray-200 transition duration-200",
          copied
            ? "-translate-y-full opacity-100"
            : "pointer-events-none -translate-y-8 opacity-0",
        )}
      >
        <div className="flex w-fit flex-row items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-sm font-medium">
          <ContentPasteRoundedIcon fontSize="small" className="inline-block" />
          <p className="text-nowrap font-light tracking-wide">Copied to clipboard</p>
        </div>
      </div>
    </button>
  );
};
