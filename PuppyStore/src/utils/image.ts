import {ImageSourcePropType} from 'react-native';

/**
 * Placeholder images for puppies without photos
 */
const placeholderImages = [
  require('../../assets/puppy_1.png'),
  require('../../assets/puppy_2.png'),
  require('../../assets/puppy_3.png'),
];

/**
 * Get a deterministic placeholder image based on an ID.
 * The same ID will always return the same placeholder image.
 */
export function getPlaceholderImage(id: string): ImageSourcePropType {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return placeholderImages[hash % placeholderImages.length];
}

/**
 * Get the image source for a puppy, falling back to a placeholder if no photo exists.
 */
export function getPuppyImageSource(
  id: string,
  photoUrl?: string,
): ImageSourcePropType {
  return photoUrl ? {uri: photoUrl} : getPlaceholderImage(id);
}
