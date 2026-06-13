import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DarkPoolStackParamList } from '../../../navigation/DarkPoolStack';

const STACK_ROUTE_NAMES = new Set(['DarkPoolHome', 'DarkPoolTicker', 'DarkPoolInvestor']);

function findDarkPoolStackNav(
  navigation: ReturnType<typeof useNavigation>
): NativeStackNavigationProp<DarkPoolStackParamList> | null {
  let current: typeof navigation | undefined = navigation;

  while (current) {
    const routeNames = current.getState?.()?.routeNames ?? [];
    if (routeNames.some((name) => STACK_ROUTE_NAMES.has(name))) {
      return current as NativeStackNavigationProp<DarkPoolStackParamList>;
    }
    current = current.getParent?.() ?? undefined;
  }

  return null;
}

export function useDarkPoolStackNav() {
  const navigation = useNavigation();
  const stackNav = findDarkPoolStackNav(navigation);
  return stackNav ?? (navigation as NativeStackNavigationProp<DarkPoolStackParamList>);
}
