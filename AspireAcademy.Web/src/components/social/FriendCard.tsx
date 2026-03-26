import { Box, Flex, Text, Badge } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import AvatarDisplay from '../gamification/AvatarDisplay';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

export interface FriendCardUser {
  id: string;
  username: string;
  displayName: string;
  avatarBase: string;
  avatarFrame: string;
  currentLevel: number;
  currentRank: string;
  loginStreakDays: number;
  totalXp: number;
}

export interface FriendCardProps {
  user: FriendCardUser;
  actions?: React.ReactNode;
}

export default function FriendCard({ user, actions }: FriendCardProps) {
  const navigate = useNavigate();

  return (
    <Box
      {...retroCardProps}
      p={4}
      cursor="pointer"
      display="flex"
      alignItems="center"
      gap={4}
      transition="transform 0.15s ease"
      _hover={{ transform: 'translateY(-2px)' }}
      onClick={() => navigate(`/users/${user.id}`)}
    >
      <AvatarDisplay
        base={user.avatarBase}
        size="sm"
        frame={user.avatarFrame}
        name={user.displayName}
      />
      <Box flex={1} minW={0}>
        <Text fontWeight="bold" truncate>
          {user.displayName || user.username}
        </Text>
        <Flex gap={3} alignItems="center" flexWrap="wrap" mt={1}>
          <Badge {...pixelFontProps} fontSize="8px" colorPalette="purple" variant="solid">
            Lvl {user.currentLevel}
          </Badge>
          <Text fontSize="xs" color="dark.muted">{user.currentRank}</Text>
          {user.loginStreakDays > 0 && (
            <Text fontSize="xs" color="game.streak">🔥 {user.loginStreakDays}</Text>
          )}
        </Flex>
      </Box>
      {actions && (
        <Box flexShrink={0} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
