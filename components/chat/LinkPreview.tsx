// ============================================
// Link Preview Component
// ============================================
// מציג תצוגה מקדימה של קישורים בהודעות צ'אט
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

// ----------- URL utils -----------

export function extractFirstUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"[\]{}|\\^`]+/gi;
  const match = text.match(urlRegex);
  if (!match) return null;
  // filter out very short / obviously invalid
  const url = match[0].replace(/[.,;!?)]+$/, ''); // strip trailing punctuation
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function extractPathLabel(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.length > 0 ? '/' + parts.slice(0, 2).join('/') : '';
  } catch {
    return '';
  }
}

// Simple in-memory cache for OG data
const ogCache = new Map<string, OgData | null>();

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
}

async function fetchOgData(url: string): Promise<OgData | null> {
  if (ogCache.has(url)) return ogCache.get(url)!;

  const domain = extractDomain(url);
  const fallback: OgData = { title: null, description: null, image: null, domain };

  try {
    // Use microlink.io free API to get OG metadata
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&meta=true&palette=false`;
    const res = await fetch(apiUrl, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      ogCache.set(url, fallback);
      return fallback;
    }
    const json = await res.json();
    if (json.status !== 'success' || !json.data) {
      ogCache.set(url, fallback);
      return fallback;
    }
    const d = json.data;
    const result: OgData = {
      title: d.title || null,
      description: d.description || null,
      image: d.image?.url || null,
      domain,
    };
    ogCache.set(url, result);
    return result;
  } catch {
    ogCache.set(url, fallback);
    return fallback;
  }
}

// ----------- Component -----------

interface LinkPreviewProps {
  url: string;
  isMe: boolean;
}

export default function LinkPreview({ url, isMe }: LinkPreviewProps) {
  const DesignTokens = useDesignTokens();
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const domain = extractDomain(url);
  const faviconUri = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchOgData(url).then((data) => {
      if (mountedRef.current) {
        setOgData(data);
        setLoading(false);
      }
    });
    return () => {
      mountedRef.current = false;
    };
  }, [url]);

  const handlePress = () => {
    void HapticFeedback.impactLight();
    WebBrowser.openBrowserAsync(url).catch(() => {});
  };

  const accentColor = isMe
    ? DesignTokens.colors.primary.light ?? DesignTokens.colors.primary.main
    : DesignTokens.colors.primary.main;

  const containerBg = isMe
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,255,255,0.05)';

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          borderColor: DesignTokens.colors.border.subtle ?? DesignTokens.colors.border.primary,
        },
      ]}
    >
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.body}>
        {/* Domain row */}
        <View style={styles.domainRow}>
          <Image
            source={{ uri: faviconUri }}
            style={styles.favicon}
            resizeMode="contain"
          />
          <Text
            style={[styles.domainText, { color: accentColor }]}
            numberOfLines={1}
          >
            {domain}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={DesignTokens.colors.text.tertiary}
            style={{ marginTop: 4, alignSelf: 'flex-start' }}
          />
        ) : (
          <>
            {ogData?.title ? (
              <Text
                style={[styles.title, { color: DesignTokens.colors.text.primary }]}
                numberOfLines={2}
              >
                {ogData.title}
              </Text>
            ) : null}
            {ogData?.description ? (
              <Text
                style={[styles.description, { color: DesignTokens.colors.text.secondary }]}
                numberOfLines={2}
              >
                {ogData.description}
              </Text>
            ) : (
              <Text
                style={[styles.urlText, { color: DesignTokens.colors.text.tertiary }]}
                numberOfLines={1}
              >
                {url.length > 60 ? url.slice(0, 57) + '…' : url}
              </Text>
            )}
            {ogData?.image ? (
              <Image
                source={{ uri: ogData.image }}
                style={styles.ogImage}
                resizeMode="cover"
              />
            ) : null}
          </>
        )}
      </View>

      <Ionicons
        name="open-outline"
        size={13}
        color={DesignTokens.colors.text.tertiary}
        style={styles.openIcon}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
    alignItems: 'stretch',
    maxWidth: 280,
  },
  accentBar: {
    width: 3,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 3,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  favicon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    opacity: 0.85,
  },
  domainText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'right',
  },
  description: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
    opacity: 0.8,
  },
  urlText: {
    fontSize: 10,
    textAlign: 'left',
    writingDirection: 'ltr',
    opacity: 0.7,
  },
  ogImage: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    marginTop: 4,
  },
  openIcon: {
    alignSelf: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
});
