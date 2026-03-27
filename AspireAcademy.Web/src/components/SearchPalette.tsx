import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Flex, Text, Input } from '@chakra-ui/react';
import { FiSearch, FiChevronRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useSearchStore } from '../store/searchStore';
import { pixelFontProps } from '../theme/aspireTheme';
import api from '../services/apiClient';

interface SearchResult {
  type: 'lesson' | 'world' | 'module' | 'page';
  title: string;
  description: string;
  url: string;
  icon: string;
}

const STATIC_PAGES: SearchResult[] = [
  { type: 'page', title: 'Dashboard', description: 'Your learning dashboard', url: '/dashboard', icon: '📊' },
  { type: 'page', title: 'Profile', description: 'View and edit your profile', url: '/profile', icon: '👤' },
  { type: 'page', title: 'Leaderboard', description: 'See top learners', url: '/leaderboard', icon: '🏆' },
  { type: 'page', title: 'Friends', description: 'Manage your friends', url: '/friends', icon: '👥' },
  { type: 'page', title: 'Achievements', description: 'View your achievements', url: '/achievements', icon: '🏅' },
];

const RECENT_SEARCHES_KEY = 'aspire-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

const TYPE_LABELS: Record<string, string> = {
  lesson: 'Lesson',
  world: 'World',
  module: 'Module',
  page: 'Page',
};

export function SearchPalette() {
  const open = useSearchStore((s) => s.open);
  const close = useSearchStore((s) => s.close);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Client-side static page filter (instant)
    const lower = q.toLowerCase();
    const staticMatches = STATIC_PAGES.filter(
      (p) => p.title.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower)
    );

    // API search
    try {
      setLoading(true);
      const res = await api.get<{ results: SearchResult[] }>('/search', { params: { q } });
      // Merge: API results first, then static pages not already present
      const apiResults = res.data.results ?? [];
      const apiUrls = new Set(apiResults.map((r) => r.url));
      const merged = [...apiResults, ...staticMatches.filter((s) => !apiUrls.has(s.url))];
      setResults(merged.slice(0, 15));
    } catch {
      // Fallback to static pages only
      setResults(staticMatches);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
  };

  const handleSelect = (result: SearchResult) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
    close();
    navigate(result.url);
  };

  const handleRecentClick = (recent: string) => {
    setQuery(recent);
    setSelectedIndex(0);
    doSearch(recent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Scroll selected item into view
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = resultsContainerRef.current;
    if (!container) return;
    const selected = container.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  const showRecent = !query.trim() && recentSearches.length > 0;

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex={9999}
      display="flex"
      alignItems="flex-start"
      justifyContent="center"
      pt={{ base: '15vh', md: '20vh' }}
      onClick={close}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'searchFadeIn 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes searchFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <Box
        bg="#1A1630"
        border="2px solid"
        borderColor="#2B1260"
        borderRadius="lg"
        boxShadow="0 24px 64px rgba(0, 0, 0, 0.5)"
        w={{ base: '92vw', md: '560px' }}
        maxH="480px"
        overflow="hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <Flex align="center" px="4" pt="3" pb="1">
          <Text {...pixelFontProps} fontSize="10px" color="aspire.500">
            Search
          </Text>
          <Box flex="1" />
          <Text fontSize="xs" color="whiteAlpha.500">
            esc to close
          </Text>
        </Flex>

        {/* Search input */}
        <Flex align="center" gap="3" px="4" py="2">
          <FiSearch size={20} color="#9185D1" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search lessons, worlds, pages..."
            variant="unstyled"
            fontSize="lg"
            color="white"
            _placeholder={{ color: 'whiteAlpha.400' }}
            autoComplete="off"
          />
          <Flex
            align="center"
            gap="1"
            px="2"
            py="0.5"
            borderRadius="md"
            bg="whiteAlpha.100"
            flexShrink={0}
          >
            <Text fontSize="xs" color="whiteAlpha.500" whiteSpace="nowrap">
              ⌘K
            </Text>
          </Flex>
        </Flex>

        <Box h="1px" bg="#2B1260" />

        {/* Results */}
        <Box
          ref={resultsContainerRef}
          maxH="340px"
          overflowY="auto"
          className="dark-scrollbar"
        >
          {loading && (
            <Flex justify="center" py="6">
              <Text fontSize="sm" color="whiteAlpha.500">Searching...</Text>
            </Flex>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <Flex justify="center" py="6" direction="column" align="center" gap="1">
              <Text fontSize="sm" color="whiteAlpha.500">No results found</Text>
              <Text fontSize="xs" color="whiteAlpha.300">Try a different search term</Text>
            </Flex>
          )}

          {!loading && showRecent && (
            <Box px="2" py="2">
              <Text fontSize="xs" color="whiteAlpha.500" px="2" pb="1" {...pixelFontProps}>
                Recent
              </Text>
              {recentSearches.map((recent) => (
                <Flex
                  key={recent}
                  align="center"
                  gap="3"
                  px="3"
                  py="2"
                  borderRadius="md"
                  cursor="pointer"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  onClick={() => handleRecentClick(recent)}
                >
                  <Text fontSize="sm" color="whiteAlpha.400">🕐</Text>
                  <Text fontSize="sm" color="whiteAlpha.700">{recent}</Text>
                </Flex>
              ))}
            </Box>
          )}

          {!loading && results.length > 0 && (
            <Box px="2" py="2">
              {results.map((result, idx) => (
                <Flex
                  key={`${result.url}-${idx}`}
                  align="center"
                  gap="3"
                  px="3"
                  py="2.5"
                  borderRadius="md"
                  cursor="pointer"
                  bg={idx === selectedIndex ? 'rgba(85, 28, 169, 0.4)' : 'transparent'}
                  _hover={{ bg: idx === selectedIndex ? 'rgba(85, 28, 169, 0.5)' : 'whiteAlpha.100' }}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  transition="background 0.1s"
                >
                  <Text fontSize="lg" flexShrink={0}>{result.icon}</Text>
                  <Box flex="1" minW="0">
                    <Flex align="center" gap="2">
                      <Text
                        fontSize="sm"
                        fontWeight="600"
                        color={idx === selectedIndex ? 'white' : 'whiteAlpha.900'}
                        truncate
                      >
                        {result.title}
                      </Text>
                      <Text
                        fontSize="10px"
                        px="1.5"
                        py="0.5"
                        borderRadius="sm"
                        bg="whiteAlpha.100"
                        color="whiteAlpha.600"
                        flexShrink={0}
                      >
                        {TYPE_LABELS[result.type] ?? result.type}
                      </Text>
                    </Flex>
                    <Text
                      fontSize="xs"
                      color="whiteAlpha.500"
                      truncate
                    >
                      {result.description}
                    </Text>
                  </Box>
                  <FiChevronRight
                    size={14}
                    color={idx === selectedIndex ? '#9185D1' : 'rgba(255,255,255,0.3)'}
                  />
                </Flex>
              ))}
            </Box>
          )}
        </Box>

        {/* Footer hint */}
        <Flex
          px="4"
          py="2"
          borderTop="1px solid"
          borderColor="#2B1260"
          gap="4"
        >
          <Flex align="center" gap="1">
            <Text fontSize="xs" color="whiteAlpha.400">↑↓</Text>
            <Text fontSize="xs" color="whiteAlpha.400">navigate</Text>
          </Flex>
          <Flex align="center" gap="1">
            <Text fontSize="xs" color="whiteAlpha.400">↵</Text>
            <Text fontSize="xs" color="whiteAlpha.400">select</Text>
          </Flex>
          <Flex align="center" gap="1">
            <Text fontSize="xs" color="whiteAlpha.400">esc</Text>
            <Text fontSize="xs" color="whiteAlpha.400">close</Text>
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}
