import type { Map } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { DEFAULT_IMAGES } from "./images";

export const addImages = async (map: MutableRefObject<Map | null>) => {
  const loadImagePromises = DEFAULT_IMAGES.map((value) => {
    const loaded = map.current
      ?.loadImage(`/map/${value}.png`)
      .then((img) => map.current?.addImage(value, img.data))
      .catch((e) => window.alert(`Failed to load image: ${value} ${e}`));
    return loaded;
  });
  await Promise.all(loadImagePromises);
};
