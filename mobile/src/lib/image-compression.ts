import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

const MAX_LISTING_IMAGE_DIMENSION = 1920;
const LISTING_IMAGE_QUALITY = 0.88;

export async function compressListingImage(asset: ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longestSide = Math.max(asset.width, asset.height);

  if (longestSide > MAX_LISTING_IMAGE_DIMENSION) {
    if (asset.width >= asset.height) {
      context.resize({ width: MAX_LISTING_IMAGE_DIMENSION, height: null });
    } else {
      context.resize({ width: null, height: MAX_LISTING_IMAGE_DIMENSION });
    }
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: LISTING_IMAGE_QUALITY,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

export async function compressListingImages(assets: ImagePickerAsset[]): Promise<string[]> {
  const compressed: string[] = [];
  for (const asset of assets) {
    compressed.push(await compressListingImage(asset));
  }
  return compressed;
}
