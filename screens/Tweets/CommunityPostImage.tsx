import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Image, View, type ImageLoadEventData, type NativeSyntheticEvent } from 'react-native';

type Props = {
  uri: string;
  borderRadius: number;
  /** Letterbox fill; omit so the parent card shows through. */
  backgroundColor?: string;
  /** Cap for very tall images; omitted uses ~62% of screen height. */
  maxHeight?: number;
};

/**
 * Width fills the card; height follows the image's intrinsic ratio.
 * Very tall images are capped (contain, no fixed-ratio crop).
 */
export default function CommunityPostImage({
  uri,
  borderRadius,
  backgroundColor = 'transparent',
  maxHeight: maxHeightProp,
}: Props) {
  const [aspectRatio, setAspectRatio] = useState<number | undefined>();
  const [boxWidth, setBoxWidth] = useState(0);
  const maxHeight =
    maxHeightProp ?? Math.round(Dimensions.get('window').height * 0.62);

  useEffect(() => {
    setAspectRatio(undefined);
  }, [uri]);

  const applySize = useCallback((width: number, height: number) => {
    if (width > 0 && height > 0) {
      setAspectRatio(width / height);
    }
  }, []);

  const onLoad = useCallback(
    (e: NativeSyntheticEvent<ImageLoadEventData>) => {
      const { width, height } = e.nativeEvent.source;
      applySize(width, height);
    },
    [applySize],
  );

  const naturalHeight =
    aspectRatio && boxWidth > 0 ? boxWidth / aspectRatio : 0;
  const imageStyle =
    aspectRatio == null
      ? { width: '100%' as const, height: 120 }
      : naturalHeight > maxHeight
        ? { width: '100%' as const, height: maxHeight }
        : { width: '100%' as const, aspectRatio };

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== boxWidth) setBoxWidth(w);
      }}
      style={{
        width: '100%',
        borderRadius,
        overflow: 'hidden',
        backgroundColor,
      }}
    >
      <Image
        source={{ uri }}
        onLoad={onLoad}
        style={[imageStyle, { borderRadius }]}
        resizeMode="contain"
      />
    </View>
  );
}
